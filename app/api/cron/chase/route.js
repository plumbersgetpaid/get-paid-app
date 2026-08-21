import { cronAuthorized } from "../../../lib/requireCron";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { formatInvoiceNumber, formatAmountForTemplate, formatDateForEmail } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getJobPhotosForPdf } from "../../../lib/getJobPhotosForPdf";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function GET(req) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const { data: outstanding } = await db
    .from("outstanding_invoices")
    .select("*");

  const settingsByBusiness = new Map();
  let sent = 0;

  for (const inv of outstanding || []) {
    const daysOverdue = inv.days_overdue;
    let templateKey = null;

    if (daysOverdue === 3) {
      templateKey = "chase_3day";
    } else if (daysOverdue === 7) {
      templateKey = "chase_7day";
    } else if (daysOverdue === 14) {
      templateKey = "chase_14day";
    }

    if (templateKey && inv.email && resend) {
      const { data: invoiceRow } = await db
        .from("invoices")
        .select("job_id, payment_link, business_id, vat_rate, vat_number, deposit_amount, deposit_received_on")
        .eq("id", inv.invoice_id)
        .single();

      if (!invoiceRow?.business_id) {
        console.error("Chase skipped - invoice has no business_id:", inv.invoice_id);
        continue;
      }

      if (!settingsByBusiness.has(invoiceRow.business_id)) {
        settingsByBusiness.set(
          invoiceRow.business_id,
          await getBusinessSettings(invoiceRow.business_id)
        );
      }
      const settings = settingsByBusiness.get(invoiceRow.business_id);
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

      const { beforePhotos, afterPhotos } = await getJobPhotosForPdf(db, invoiceRow?.job_id);

      const template = await getTemplate(templateKey, invoiceRow.business_id);
      // Chase the BALANCE still owed - a received deposit has already been
      // paid and must never be demanded again.
      const chaseBalance = Math.max(
        0,
        Math.round((Number(inv.amount) - (Number(invoiceRow?.deposit_amount) || 0)) * 100) / 100
      );
      const vars = {
        customer_name: inv.customer_name,
        // Bare formatted number ("1,880.40") - the template writes the £ -
        // and a readable date ("25 August 2026"), not the raw "2026-08-25".
        amount: formatAmountForTemplate(chaseBalance, settings.currency),
        due_date: formatDateForEmail(inv.due_date),
        business_name: settings.business_name,
      };

      let paymentNote = "";
      if (invoiceRow?.payment_link) {
        const paymentNoteTemplate = await getTemplate("payment_note", invoiceRow.business_id);
        paymentNote = renderTemplate(paymentNoteTemplate.body, vars);
      }

      const pdfBytes = await generateInvoicePdfBytes({
        invoiceNumber: formatInvoiceNumber(inv.invoice_number),
        customerName: inv.customer_name,
        customerEmail: inv.email,
        customerPhone: inv.phone,
        jobType: inv.job_type,
        location: inv.location,
        amount: inv.amount,
        dueDate: inv.due_date,
        status: "unpaid",
        paymentLink: invoiceRow?.payment_link || undefined,
        paymentNote: paymentNote || undefined,
        vatRate: invoiceRow?.vat_rate,
        vatNumber: invoiceRow?.vat_number,
        depositAmount: invoiceRow?.deposit_amount,
        depositReceivedOn: invoiceRow?.deposit_received_on,
        business: { ...business, beforePhotos, afterPhotos },
      });

      const subject = renderTemplate(template.subject, vars) || "Payment reminder";
      let bodyText = renderTemplate(template.body, vars);
      if (invoiceRow?.payment_link) {
        bodyText += `\n\nPay now: ${invoiceRow.payment_link}`;
        if (paymentNote) {
          bodyText += `\n${paymentNote}`;
        }
      }
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}</div>`;

      await resend.emails.send({
        from: getEmailFrom(settings.business_name),
        to: inv.email,
        replyTo: settings.contact_email || undefined,
        subject,
        html,
        attachments: [
          {
            filename: `invoice-${formatInvoiceNumber(inv.invoice_number)}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      });

      // chase_log is the only record this automated dunning email went out.
      // Day-exact spacing (3/7/14) means no auto re-send, but a silently
      // lost row makes the invoice read "never chased" and the tradesperson
      // manually chases again — duplicate demand to the homeowner. Log loud.
      const { error: logErr } = await db.from("chase_log").insert({
        invoice_id: inv.invoice_id,
        message: bodyText,
        channel: "email",
        business_id: invoiceRow.business_id,
      });
      if (logErr) {
        console.error("Auto chase: email sent but chase_log insert FAILED", inv.invoice_id, logErr);
      }

      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
