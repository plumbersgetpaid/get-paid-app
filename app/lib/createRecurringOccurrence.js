import { getTemplate, renderTemplate } from "./getTemplate";
import { textToEmailHtml } from "./emailHtml";
import { getEmailFrom } from "./emailFrom";
import { sendWhatsAppMessage } from "./sendWhatsApp";
import { advanceDate } from "./duration";
import { Resend } from "resend";

// Creates one real job from a recurring job template's current due
// occurrence: books it in, warns about any genuine scheduling clash,
// notifies the client if the time is real and that's turned on, then
// advances the template to its next occurrence. Never invoices
// automatically - that always happens the normal way, when the tradie
// marks the job done.
export async function createRecurringOccurrence(db, settings, r) {
  const { data: customer } = await db
    .from("customers")
    .select("*")
    .eq("id", r.customer_id)
    .single();

  const preferredTime = r.preferred_time || "09:00";
  // A one-off time set specifically for the next occurrence overrides
  // everything else, and always counts as a real, confirmed time
  const hasOneOffTime = !!r.next_occurrence_time;
  const confirmLater = !hasOneOffTime && !!r.confirm_time_later;
  const timeIsConfirmed = !confirmLater;
  // If the time isn't being fixed yet, use a neutral placeholder just so
  // the job has a real timestamp - it's flagged as unconfirmed below, so
  // the UI shows "time to be confirmed" instead of this placeholder
  const timeToUse = hasOneOffTime ? r.next_occurrence_time : confirmLater ? "12:00" : preferredTime;
  const start = new Date(`${r.next_occurrence}T${timeToUse}:00`);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  // Only check for a scheduling clash when the time is real - checking a
  // placeholder time against other bookings would just produce false
  // warnings about a time nobody actually committed to
  let conflict = null;
  if (timeIsConfirmed) {
    const { data: sameDay } = await db
      .from("jobs")
      .select("id, job_type, customer_id, scheduled_start, scheduled_end")
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null)
      .gte("scheduled_start", `${r.next_occurrence}T00:00:00`)
      .lte("scheduled_start", `${r.next_occurrence}T23:59:59`);

    conflict = (sameDay || []).find((o) => {
      const oStart = new Date(o.scheduled_start);
      const oEnd = new Date(o.scheduled_end);
      return start < oEnd && end > oStart;
    });
  }

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .insert({
      customer_id: r.customer_id,
      job_type: r.job_type,
      location: r.location,
      amount: r.amount,
      status: "in_progress",
      accepted_at: new Date().toISOString(),
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      time_confirmed: timeIsConfirmed,
    })
    .select()
    .single();

  if (jobErr || !job) {
    console.error("Recurring job creation error:", jobErr);
    return { created: false };
  }

  // Warn the tradie if this landed on top of another booking
  if (conflict && settings.contact_email && process.env.RESEND_API_KEY) {
    try {
      const { data: conflictCustomer } = await db
        .from("customers")
        .select("name")
        .eq("id", conflict.customer_id)
        .single();
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: getEmailFrom(settings.business_name),
        to: settings.contact_email,
        subject: `Scheduling clash - recurring job for ${customer?.name || "a customer"}`,
        html: `<div style="font-family:sans-serif;">A recurring job for <strong>${
          customer?.name || "a customer"
        }</strong> (${r.job_type || "job"}) was just auto-booked for ${start.toLocaleString(
          "en-GB",
          { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }
        )}, but that overlaps with a job already booked for ${
          conflictCustomer?.name || "another customer"
        } (${conflict.job_type || "job"}) at the same time. You may want to reschedule one of them.</div>`,
      });
    } catch (e) {
      console.error("Recurring conflict warning email error:", e);
    }
  }

  // Let the client know, if this recurring job has that turned on - only
  // once there's a real time to actually tell them
  if (timeIsConfirmed && (r.notify_email || r.notify_whatsapp) && customer) {
    try {
      const template = await getTemplate("booking_confirmation");
      const vars = {
        customer_name: customer.name,
        job_type: job.job_type || "your job",
        start_date: start.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        start_time: timeToUse,
        duration: "2 hours",
        business_name: settings.business_name,
      };
      const bodyText = renderTemplate(template.body, vars);
      const subject = renderTemplate(template.subject, vars) || "Booking confirmed";

      if (r.notify_email && customer.email && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
          bodyText
        )}</div>`;
        await resend.emails.send({
          from: getEmailFrom(settings.business_name),
          to: customer.email,
          subject,
          html,
        });
      }
      if (r.notify_whatsapp && customer.phone) {
        await sendWhatsAppMessage(customer.phone, bodyText);
      }
    } catch (e) {
      console.error("Recurring booking confirmation error:", e);
    }
  }

  const nextOccurrence = advanceDate(r.next_occurrence, r.frequency_value, r.frequency_unit);
  await db
    .from("recurring_jobs")
    .update({ next_occurrence: nextOccurrence, next_occurrence_time: null })
    .eq("id", r.id);

  return { created: true, job };
}
