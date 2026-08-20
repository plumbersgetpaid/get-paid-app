import { getTemplate, renderTemplate } from "./getTemplate";
import { textToEmailHtml } from "./emailHtml";
import { getEmailFrom } from "./emailFrom";
import { advanceDate } from "./duration";
import { narrowToRealClashes } from "./jobConflicts";
import { logEmailSent } from "./logEmail";
import { Resend } from "resend";

export async function createRecurringOccurrence(db, settings, r) {
  const { data: customer } = await db
    .from("customers")
    .select("*")
    .eq("id", r.customer_id)
    .single();

  const preferredTime = r.preferred_time || "09:00";
  const hasOneOffTime = !!r.next_occurrence_time;
  const confirmLater = !hasOneOffTime && !!r.confirm_time_later;
  const timeIsConfirmed = !confirmLater;
  const timeToUse = hasOneOffTime ? r.next_occurrence_time : confirmLater ? "12:00" : preferredTime;
  const start = new Date(`${r.next_occurrence}T${timeToUse}:00`);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  // Who this occurrence is for. Worked out up front because the clash
  // check below needs it - two jobs at the same time are only a problem
  // if the same person is expected at both.
  const assigneeIds = new Set();
  if (r.assigned_to) assigneeIds.add(r.assigned_to);
  const { data: recurringShares } = await db
    .from("recurring_job_shares")
    .select("team_member_id")
    .eq("recurring_job_id", r.id);
  for (const s of recurringShares || []) {
    assigneeIds.add(s.team_member_id);
  }

  let conflict = null;
  if (timeIsConfirmed) {
    const { data: sameDay } = await db
      .from("jobs")
      .select("id, job_type, customer_id, scheduled_start, scheduled_end")
      // This runs on the service-role client, which bypasses row-level
      // security, so the business has to be filtered explicitly. Without
      // it the search covered every business on the platform - and the
      // warning email below names the clashing customer, so one business
      // could be told another's customer name and job type.
      .eq("business_id", r.business_id)
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null)
      .gte("scheduled_start", `${r.next_occurrence}T00:00:00`)
      .lte("scheduled_start", `${r.next_occurrence}T23:59:59`);

    const overlapping = (sameDay || []).filter((o) => {
      const oStart = new Date(o.scheduled_start);
      const oEnd = new Date(o.scheduled_end);
      return start < oEnd && end > oStart;
    });

    const realClashes = await narrowToRealClashes(db, overlapping, assigneeIds);
    conflict = realClashes[0] || null;
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
      created_by: r.created_by || null,
      assigned_to: null,
      business_id: r.business_id,
    })
    .select()
    .single();

  if (jobErr || !job) {
    console.error("Recurring job creation error:", jobErr);
    return { created: false };
  }

  if (assigneeIds.size > 0) {
    const { error: sharesErr } = await db.from("job_shares").insert(
      [...assigneeIds].map((teamMemberId) => ({
        job_id: job.id,
        team_member_id: teamMemberId,
        business_id: r.business_id,
      }))
    );
    if (sharesErr) {
      console.error("Recurring occurrence assign error:", sharesErr);
    }
  }

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

  if (timeIsConfirmed && r.notify_email && customer) {
    try {
      // Explicit business id: this runs from the cron with no session, so
      // the ambient lookup finds no member and silently fell back to the
      // STOCK wording - the business's customised template was ignored.
      const template = await getTemplate("booking_confirmation", r.business_id);
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
          replyTo: settings.contact_email || undefined,
          subject,
          html,
        });
        await logEmailSent({
          businessId: r.business_id,
          jobId: job.id,
          customerId: r.customer_id,
          to: customer.email,
          kind: "booking_confirmation",
          subject,
        });
      }
    } catch (e) {
      console.error("Recurring booking confirmation error:", e);
    }
  }

  const nextOccurrence = advanceDate(r.next_occurrence, r.frequency_value, r.frequency_unit);
  // If advancing the date fails, tomorrow's cron sees the same
  // next_occurrence and creates the same job again - and again every day
  // after, each with its own booking email to the customer. The worst
  // failure mode in this file, so it does not get to fail silently.
  const { error: advanceErr } = await db
    .from("recurring_jobs")
    .update({ next_occurrence: nextOccurrence, next_occurrence_time: null })
    .eq("id", r.id);
  if (advanceErr) {
    console.error(
      `Recurring ${r.id}: occurrence created but next_occurrence NOT advanced - will duplicate daily until fixed:`,
      advanceErr
    );
  }

  return { created: true, job };
}
