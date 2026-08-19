import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { formatInvoiceNumber } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getJobPhotosForPdf } from "../../../lib/getJobPhotosForPdf";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canInvoice } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { claimRequest, releaseRequest } from "../../../lib/idempotency";

// Lets the plumber chase a specific invoice on demand, on top of the
// automatic daily chase cron job.
export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const invoiceId = form.get("invoiceId");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  // Retry protection: a resend of this exact action - flaky signal,
  // double-tap, browser resubmit, offline replay - is answered with the
  // success response instead of running twice. See lib/idempotency.js.
  const claim = await claimRequest(form.get("request_id"), currentMember.business_id, "invoice-chase");
  if (claim.duplicate) {
    return NextResponse.redirect(new URL("/", req.url), 303);
  }


  const db = await getScopedDb(currentMember);
  // outstanding_invoices is a database view, not a direct table -
  // Postgres views don't automatically carry RLS through to their
  // underlying tables the same way a normal table does unless
  // specifically configured to, which hasn't been verified here. Kept
  // on the service-role client until that's confirmed safe, rather than
  // risking either a broken query or a silent cross-business leak.
  const adminDb = supabaseAdmin();

  // Scoped by business_id as well as invoice id: without it, anyone
  // could chase another business's customer just by knowing an
  // invoice id. The view now exposes business_id for exactly this.
  const { data: inv, error: fetchErr } = await adminDb
    .from("outstanding_invoices")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("business_id", currentMember.business_id)
    .single();

  if (fetchErr || !inv) {
    console.error("Chase lookup error:", fetchErr);
    await releaseRequest(claim);
    return NextResponse.json({ error: "Invoice not found" }, { status: 400 });
  }

  if (inv.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const settings = await getBusinessSettings();
      const { data: invoiceRow } = await db
        .from("invoices")
        .select("job_id, payment_link")
        .eq("id", invoiceId)
        .single();
      const { beforePhotos, afterPhotos } = await getJobPhotosForPdf(db, invoiceRow?.job_id);
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
        beforePhotos,
        afterPhotos,
      };

      const template = await getTemplate("chase_manual");
      const vars = {
        customer_name: inv.customer_name,
        amount: inv.amount,
        due_date: inv.due_date,
        business_name: settings.business_name,
      };

      let paymentNote = "";
      if (invoiceRow?.payment_link) {
        const paymentNoteTemplate = await getTemplate("payment_note");
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
        business,
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

      // business_id set explicitly - same requirement as any other insert
      await db.from("chase_log").insert({
        invoice_id: inv.invoice_id,
        message: bodyText,
        channel: "email",
        business_id: currentMember.business_id,
      });
    } catch (e) {
      console.error("Manual chase send error:", e);
    }
  } else {
    console.log("Skipped manual chase - no email on file or Resend key missing");
  }

  return NextResponse.redirect(new URL("/", req.url), 303);
}
