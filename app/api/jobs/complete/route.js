import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { formatCurrency, formatInvoiceNumber } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Builds a simple before/after photo gallery as inline HTML for the
// invoice email, if the tradie opted in and photos exist for this job.
async function buildPhotosHtml(db, jobId, attachPhotos) {
  if (!attachPhotos) return "";

  const { data: photos } = await db
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (!photos || photos.length === 0) return "";

  const imgTag = (p) =>
    `<img src="${p.url}" alt="${p.label}" style="width:150px;height:110px;object-fit:cover;border-radius:6px;margin:4px;" />`;

  const before = photos.filter((p) => p.label === "before");
  const after = photos.filter((p) => p.label === "after");

  let html = `<div style="margin-top:20px;">`;
  if (before.length > 0) {
    html += `<div style="font-weight:600;margin-bottom:4px;">Before</div><div>${before
      .map(imgTag)
      .join("")}</div>`;
  }
  if (after.length > 0) {
    html += `<div style="font-weight:600;margin:10px 0 4px;">After</div><div>${after
      .map(imgTag)
      .join("")}</div>`;
  }
  html += `</div>`;
  return html;
}

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const dueDateInput = form.get("dueDate"); // yyyy-mm-dd from the form, optional
  const amountInput = form.get("amount"); // optional - lets the price be adjusted from the original quote
  const noteInput = (form.get("note") || "").toString().trim(); // optional explanation for a price change
  const attachPhotos = form.get("attachPhotos") === "1";

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

  // Fetch the customer separately (avoids relying on Supabase auto-detecting
  // the foreign key relationship, which can silently fail on new projects)
  const { data: customer, error: custErr } = await db
    .from("customers")
    .select("*")
    .eq("id", job.customer_id)
    .single();

  if (custErr) {
    console.error("Customer lookup error:", custErr);
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
    })
    .select()
    .single();

  if (invErr) {
    console.error("Invoice insert error:", invErr);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  await db.from("jobs").update({ status: "invoiced" }).eq("id", job.id);

  // 3. Send the invoice email, with the invoice attached as a PDF
  if (customer?.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
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

      // Price-change context is dynamic, so it's appended after the
      // template rather than being part of the editable text itself
      if (priceChanged) {
        bodyText += `\n\nOriginally quoted ${formatCurrency(
          quotedAmount,
          settings.currency
        )} - adjusted to reflect the work carried out.`;
        if (noteInput) {
          bodyText += `\n${noteInput}`;
        }
      }

      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}${await buildPhotosHtml(db, job.id, attachPhotos)}</div>`;

      const result = await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: `${settings.business_name} <onboarding@resend.dev>`,
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
      console.error("Resend send error:", e);
    }
  } else {
    console.log("Skipped sending email - customer email or Resend key missing", {
      hasEmail: !!customer?.email,
      hasKey: !!process.env.RESEND_API_KEY,
    });
  }

  // 4. Also send an SMS confirmation (optional - requires Twilio setup)
  // See README for enabling this.

  return NextResponse.redirect(new URL("/", req.url));
}

