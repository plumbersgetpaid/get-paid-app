import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { formatCurrency, formatInvoiceNumber } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getJobPhotosForPdf } from "../../../lib/getJobPhotosForPdf";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Uploads any selected before/after photos to storage and records them
// against the job, all at once rather than one at a time - this alone was
// a meaningful chunk of the old 20-30 second wait when there were several
// photos.
async function uploadJobPhotos(db, jobId, files, label) {
  const validFiles = files.filter((f) => f && typeof f !== "string" && f.size > 0);

  await Promise.all(
    validFiles.map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${jobId}/${label}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error: uploadError } = await db.storage
        .from("job-photos")
        .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });

      if (uploadError) {
        console.error(`Job photo upload error (${label}):`, uploadError);
        return;
      }

      const { data: publicUrlData } = db.storage.from("job-photos").getPublicUrl(path);

      await db.from("job_photos").insert({
        job_id: jobId,
        url: publicUrlData.publicUrl,
        storage_path: path,
        label,
      });
    })
  );
}

// Everything after the job/invoice are created: uploading photos, building
// the PDF, sending the email. Photo work is parallelized internally (see
// uploadJobPhotos and generateInvoicePdf's photo section), which is the
// real, verifiable speed win here - the response only returns once this is
// genuinely done, since there's no reliably-available way in this
// environment to hand it off to run after the response instead.
async function finishInvoice({
  db,
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
      uploadJobPhotos(db, job.id, beforeFiles, "before"),
      uploadJobPhotos(db, job.id, afterFiles, "after"),
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
      business,
    });

    const invoiceTemplate = await getTemplate("invoice");
    const invoiceVars = {
      customer_name: customer.name,
      job_type: job.job_type || "Plumbing work",
      amount: formatCurrency(finalAmount, settings.currency).replace(/^[^\d-]*/, ""),
      due_date: dueDate.toDateString(),
      business_name: settings.business_name,
    };
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
    }

    const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
      bodyText
    )}</div>`;

    const result = await resend.emails.send({
      // Using Resend's test sending address for now - swap this for your
      // own verified domain once you're ready to send to real customers.
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
    console.log("Resend result:", result);

    await db.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", invoice.id);
  } catch (e) {
    console.error("Finish invoice error:", e);
  }
}

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const dueDateInput = form.get("dueDate"); // yyyy-mm-dd from the form, optional
  const amountInput = form.get("amount"); // optional - lets the price be adjusted from the original quote
  const noteInput = (form.get("note") || "").toString().trim(); // optional explanation for a price change
  const paymentLinkInput = (form.get("paymentLink") || "").toString().trim();
  const from = (form.get("from") || "").toString();
  const beforeFiles = form.getAll("beforePhotos");
  const afterFiles = form.getAll("afterPhotos");

  const db = supabaseAdmin();

  // 1. Mark the job complete - the note is always saved to the job record
  // (for internal reference/dispute protection), regardless of whether the
  // price changed, even though it's only shown to the customer if it did
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

  // 2. Create the invoice - use the due date chosen on the complete-job
  // screen if one was provided, otherwise default to 14 days from now
  const dueDate = dueDateInput ? new Date(dueDateInput) : new Date();
  if (!dueDateInput) {
    dueDate.setDate(dueDate.getDate() + 14);
  }

  // The amount can be adjusted on the complete-job screen if more or less
  // work was done than originally quoted. job.amount still holds the
  // original quote, so we keep that as the historical record.
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
    })
    .select()
    .single();

  if (invErr) {
    console.error("Invoice insert error:", invErr);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  await db.from("jobs").update({ status: "invoiced" }).eq("id", job.id);

  // 3. Upload photos, build the PDF, and send the email - photo work runs
  // in parallel internally, which is the real speed improvement here
  await finishInvoice({
    db,
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

  // Take the tradie back to wherever they came from, rather than always
  // dumping them on the Today screen
  const returnPath = from === "work" ? "/work?tab=jobs" : "/";
  return NextResponse.redirect(new URL(returnPath, req.url));
}
