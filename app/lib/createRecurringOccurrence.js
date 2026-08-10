import { getTemplate, renderTemplate } from "./getTemplate";
import { generateInvoicePdfBytes } from "./generateInvoicePdf";
import { formatCurrency, formatInvoiceNumber } from "./formatCurrency";
import { textToEmailHtml } from "./emailHtml";
import { getEmailFrom } from "./emailFrom";
import { sendWhatsAppMessage } from "./sendWhatsApp";
import { advanceDate } from "./duration";
import { Resend } from "resend";

// Creates one real job from a recurring job template's current due
// occurrence: books it in, warns about any genuine scheduling clash,
// notifies the client if the time is real and that's turned on, sends an
// invoice immediately only if auto-invoice is on AND the time is actually
// confirmed (never invoices ahead of a time that's still to-be-decided),
// then advances the template to its next occurrence.
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

  // Only invoice immediately if auto-invoice is on AND there's an actual
  // confirmed time - billing for a visit before you know when it happens
  // would be confusing. If the time isn't confirmed yet, this just falls
  // back to the normal "mark done" flow once the work is actually done.
  const invoiceNow = !!r.auto_invoice && timeIsConfirmed;

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .insert({
      customer_id: r.customer_id,
      job_type: r.job_type,
      location: r.location,
      amount: r.amount,
      status: invoiceNow ? "invoiced" : "in_progress",
      accepted_at: new Date().toISOString(),
      completed_at: invoiceNow ? new Date().toISOString() : null,
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

  if (invoiceNow && customer) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const { data: invoice, error: invErr } = await db
      .from("invoices")
      .insert({
        job_id: job.id,
        amount: r.amount,
        due_date: dueDate.toISOString().slice(0, 10),
        status: "unpaid",
      })
      .select()
      .single();

    if (!invErr && invoice && customer.email && process.env.RESEND_API_KEY) {
      try {
        const business = {
          businessName: settings.business_name,
          accentColor: settings.accent_color,
          logoUrl: settings.logo_url,
          contactEmail: settings.contact_email,
          contactPhone: settings.contact_phone,
          invoiceNote: settings.invoice_note,
          headerTagline: settings.header_tagline,
          paymentTerms: settings.payment_terms,
          bankDetails: settings.bank_details,
          currency: settings.currency,
        };

        const pdfBytes = await generateInvoicePdfBytes({
          invoiceNumber: formatInvoiceNumber(invoice.invoice_number),
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          jobType: job.job_type,
          location: job.location,
          amount: invoice.amount,
          dueDate: invoice.due_date,
          status: invoice.status,
          createdAt: invoice.created_at,
          business,
        });

        const invoiceTemplate = await getTemplate("invoice");
        const vars = {
          customer_name: customer.name,
          job_type: job.job_type || "Recurring service",
          amount: formatCurrency(r.amount, settings.currency).replace(/^[^\d-]*/, ""),
          due_date: dueDate.toDateString(),
          business_name: settings.business_name,
        };
        const subject =
          renderTemplate(invoiceTemplate.subject, vars) ||
          `Invoice for ${job.job_type || "your recurring service"}`;
        const bodyText = renderTemplate(invoiceTemplate.body, vars);
        const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
          bodyText
        )}</div>`;

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: getEmailFrom(settings.business_name),
          to: customer.email,
          subject,
          html,
          attachments: [
            {
              filename: `invoice-${formatInvoiceNumber(invoice.invoice_number)}.pdf`,
              content: Buffer.from(pdfBytes),
            },
          ],
        });
      } catch (e) {
        console.error("Recurring job invoice email error:", e);
      }
    }
  }

  const nextOccurrence = advanceDate(r.next_occurrence, r.frequency_value, r.frequency_unit);
  await db
    .from("recurring_jobs")
    .update({ next_occurrence: nextOccurrence, next_occurrence_time: null })
    .eq("id", r.id);

  return { created: true, job };
}
