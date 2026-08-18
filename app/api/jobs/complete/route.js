import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { formatCurrency, formatInvoiceNumber } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getJobPhotosForPdf } from "../../../lib/getJobPhotosForPdf";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canInvoice } from "../../../lib/permissions";
import { canAccessJob } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

async function uploadJobPhotos(db, adminDb, jobId, files, label, businessId) {
  const validFiles = files.filter((f) => f && typeof f !== "string" && f.size > 0);

  await Promise.all(
    validFiles.map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${jobId}/${label}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error: uploadError } = await adminDb.storage
        .from("job-photos")
        .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });

      if (uploadError) {
        console.error(`Job photo upload error (${label}):`, uploadError);
        return;
      }

      // Private bucket - the storage path is the record, links are signed
      // on read. See lib/signedMediaUrls.js.
      const { error: insertError } = await db.from("job_photos").insert({
        job_id: jobId,
        url: null,
        storage_path: path,
        label,
        business_id: businessId,
      });

      // This used to be unchecked, which hid a real failure: the file
      // uploaded, the row was rejected, and the photo simply never
      // appeared - no error anywhere, on a screen the user had already
      // left. Log it loudly and remove the now-unreferenced file rather
      // than leaving it orphaned in the bucket.
      if (insertError) {
        console.error(`Job photo record failed (${label}), removing orphan:`, insertError);
        await adminDb.storage.from("job-photos").remove([path]);
      }
    })
  );
}

async function finishInvoice({
  db,
  adminDb,
  businessId,
  job,
  invoice,
  beforeFiles,
  afterFiles,
  noteInput,
  paymentLinkInput,
  priceChanged,
  quotedAmount,
  finalAmount,
  dueDate,
}) {
  try {
    await Promise.all([
      uploadJobPhotos(db, adminDb, job.id, beforeFiles, "before", businessId),
      uploadJobPhotos(db, adminDb, job.id, afterFiles, "after", businessId),
    ]);

    const { data: customer } = await db
      .from("customers")
      .select("*")
      .eq("id", job.customer_id)
      .single();

    if (!customer?.email || !process.env.RESEND_API_KEY) {
      console.log("Skipped sending email - customer email or Resend key missing", {
        hasEmail: !!customer?.email,
        hasKey: !!process.env.RESEND_API_KEY,
      });
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const settings = await getBusinessSettings();
    const { beforePhotos, afterPhotos } = await getJobPhotosForPdf(db, job.id);
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

    const invoiceTemplate = await getTemplate("invoice");
    const invoiceVars = {
      customer_name: customer.name,
      job_type: job.job_type || "Plumbing work",
      amount: formatCurrency(finalAmount, settings.currency).replace(/^[^\d-]*/, ""),
      due_date: dueDate.toDateString(),
      business_name: settings.business_name,
    };

    let paymentNote = "";
    if (paymentLinkInput) {
      const paymentNoteTemplate = await getTemplate("payment_note");
      paymentNote = renderTemplate(paymentNoteTemplate.body, invoiceVars);
    }

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
      quotedAmount: priceChanged ? quotedAmount : undefined,
      priceChangeNote: priceChanged ? noteInput : undefined,
      paymentLink: paymentLinkInput || undefined,
      paymentNote: paymentNote || undefined,
      business,
    });

    const subject =
      renderTemplate(invoiceTemplate.subject, invoiceVars) ||
      `Invoice for ${job.job_type || "your recent job"}`;

    let bodyText = renderTemplate(invoiceTemplate.body, invoiceVars);
    if (job.location) {
      bodyText += `\n\nJob location: ${job.location}`;
    }
    if (priceChanged) {
      bodyText += `\n\nOriginally quoted ${formatCurrency(
        quotedAmount,
        settings.currency
      )} - adjusted to reflect the work carried out.`;
      if (noteInput) {
        bodyText += `\n${noteInput}`;
      }
    }
    if (paymentLinkInput) {
      bodyText += `\n\nPay now: ${paymentLinkInput}`;
      if (paymentNote) {
        bodyText += `\n${paymentNote}`;
      }
    }

    const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
      bodyText
    )}</div>`;

    const result = await resend.emails.send({
      from: getEmailFrom(settings.business_name),
      to: customer.email,
      replyTo: settings.contact_email || undefined,
      subject,
      html,
      attachments: [
        {
          filename: `invoice-${formatInvoiceNumber(invoice.invoice_number)}.pdf`,
          content: Buffer.from(pdfBytes),
        },
      ],
    });
    console.log("Resend result:", result);

    const { error: sentErr } = await db
      .from("invoices")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", invoice.id);
    if (sentErr) console.error(`Invoice ${invoice.id} emailed but sent_at not recorded:`, sentErr);
  } catch (e) {
    console.error("Finish invoice error:", e);
  }
}

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  let dueDateInput = form.get("dueDate");
  let amountInput = form.get("amount");
  const noteInput = (form.get("note") || "").toString().trim();
  let paymentLinkInput = (form.get("paymentLink") || "").toString().trim();
  const from = (form.get("from") || "").toString();
  const beforeFiles = form.getAll("beforePhotos");
  const afterFiles = form.getAll("afterPhotos");

  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const db = await getScopedDb(currentMember);
  const adminDb = supabaseAdmin();

  const { data: jobForCheck } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", jobId)
    .maybeSingle();
  const hasAccess = await canAccessJob(db, jobForCheck, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // Stop a double submit creating a second invoice. Completing a job does
  // photo uploads + PDF + email before redirecting, so it's slow enough to
  // double-click or retry - and there's no unique constraint on
  // invoices.job_id, so a second pass just takes the next invoice number
  // and emails the customer again. If this job already has an invoice,
  // treat completion as already done and return quietly.
  const { data: existingInvoice } = await db
    .from("invoices")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();
  if (existingInvoice) {
    const already = (form.get("from") || "").toString() === "work" ? "/work?tab=jobs" : "/";
    return NextResponse.redirect(new URL(already, req.url), 303);
  }

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      completion_note: noteInput || null,
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (jobErr || !job) {
    console.error("Job update error:", jobErr);
    return NextResponse.json({ error: "Job not found" }, { status: 400 });
  }

  const dueDate = dueDateInput ? new Date(dueDateInput) : new Date();
  if (!dueDateInput) {
    dueDate.setDate(dueDate.getDate() + 14);
  }

  const quotedAmount = Number(job.amount);
  const finalAmount = amountInput ? Number(amountInput) : quotedAmount;
  const priceChanged = Math.abs(finalAmount - quotedAmount) > 0.001;

  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .insert({
      job_id: job.id,
      amount: finalAmount,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "unpaid",
      payment_link: paymentLinkInput || null,
      business_id: currentMember.business_id,
    })
    .select()
    .single();

  if (invErr) {
    console.error("Invoice insert error:", invErr);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  const { error: statusErr } = await db.from("jobs").update({ status: "invoiced" }).eq("id", job.id);
  if (statusErr) {
    // The invoice exists by this point - a silent failure leaves the job
    // looking un-invoiced and invites a second invoice for the same work.
    console.error(`Job ${job.id} invoiced but status update failed:`, statusErr);
  }

  await finishInvoice({
    db,
    adminDb,
    businessId: currentMember.business_id,
    job,
    invoice,
    beforeFiles,
    afterFiles,
    noteInput,
    paymentLinkInput,
    priceChanged,
    quotedAmount,
    finalAmount,
    dueDate,
  });

  const returnPath = from === "work" ? "/work?tab=jobs" : "/";
  return NextResponse.redirect(new URL(returnPath, req.url), 303);
}
