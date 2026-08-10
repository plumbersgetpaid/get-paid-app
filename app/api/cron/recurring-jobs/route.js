import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { formatCurrency, formatInvoiceNumber } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { advanceDate } from "../../../lib/duration";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Designed to be called once a day, early morning, by a scheduler. Creates
// a real job (and optionally an invoice) for every recurring job whose
// next occurrence has arrived, then advances it to the following one.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const todayStr = new Date().toISOString().slice(0, 10);
  const settings = await getBusinessSettings();

  const { data: due } = await db
    .from("recurring_jobs")
    .select("*")
    .eq("active", true)
    .lte("next_occurrence", todayStr);

  let created = 0;

  for (const r of due || []) {
    const { data: customer } = await db
      .from("customers")
      .select("*")
      .eq("id", r.customer_id)
      .single();

    const start = new Date(`${r.next_occurrence}T09:00:00`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const { data: job, error: jobErr } = await db
      .from("jobs")
      .insert({
        customer_id: r.customer_id,
        job_type: r.job_type,
        location: r.location,
        amount: r.amount,
        status: r.auto_invoice ? "invoiced" : "in_progress",
        accepted_at: new Date().toISOString(),
        completed_at: r.auto_invoice ? new Date().toISOString() : null,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
      })
      .select()
      .single();

    if (jobErr || !job) {
      console.error("Recurring job creation error:", jobErr);
      continue;
    }
    created += 1;

    if (r.auto_invoice && customer) {
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
    await db.from("recurring_jobs").update({ next_occurrence: nextOccurrence }).eq("id", r.id);
  }

  return NextResponse.json({ ok: true, created });
}
