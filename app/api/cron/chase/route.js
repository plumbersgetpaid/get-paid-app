import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { formatInvoiceNumber } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getJobPhotosForPdf } from "../../../lib/getJobPhotosForPdf";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// This route is designed to be called once a day by a scheduler
// (Vercel Cron, or an n8n workflow). It finds overdue invoices and
// sends an escalating reminder message.

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const { data: outstanding } = await db
    .from("outstanding_invoices")
    .select("*");

  const settings = await getBusinessSettings();
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

  let sent = 0;

  for (const inv of outstanding || []) {
    const daysOverdue = inv.days_overdue;
    let templateKey = null;

    // Escalating tone based on how overdue the invoice is
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
        .select("job_id, payment_link")
        .eq("id", inv.invoice_id)
        .single();
      const { beforePhotos, afterPhotos } = await getJobPhotosForPdf(db, invoiceRow?.job_id);

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
        business: { ...business, beforePhotos, afterPhotos },
      });

      const template = await getTemplate(templateKey);
      const vars = {
        customer_name: inv.customer_name,
        amount: inv.amount,
        due_date: inv.due_date,
        business_name: settings.business_name,
      };
      const subject = renderTemplate(template.subject, vars) || "Payment reminder";
      let bodyText = renderTemplate(template.body, vars);
      if (invoiceRow?.payment_link) {
        bodyText += `\n\nPay now: ${invoiceRow.payment_link}`;
      }
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}</div>`;

      await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: getEmailFrom(settings.business_name),
        to: inv.email,
        subject,
        html,
        attachments: [
          {
            filename: `invoice-${formatInvoiceNumber(inv.invoice_number)}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      });

      await db.from("chase_log").insert({
        invoice_id: inv.invoice_id,
        message: bodyText,
        channel: "email",
      });

      sent++;
    }

    // To also send via SMS/WhatsApp, add Twilio logic here using inv.phone
  }

  return NextResponse.json({ ok: true, sent });
}
