import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const dueDateInput = form.get("dueDate"); // yyyy-mm-dd from the form, optional
  const amountInput = form.get("amount"); // optional - lets the price be adjusted from the original quote

  const db = supabaseAdmin();

  // 1. Mark the job complete
  const { data: job, error: jobErr } = await db
    .from("jobs")
    .update({ status: "complete", completed_at: new Date().toISOString() })
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
      };

      const pdfBytes = await generateInvoicePdfBytes({
        invoiceIdShort: invoice.id.slice(0, 8).toUpperCase(),
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        jobType: job.job_type,
        amount: invoice.amount,
        dueDate: invoice.due_date,
        status: invoice.status,
        createdAt: invoice.created_at,
        business,
      });

      const result = await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: `${settings.business_name} <onboarding@resend.dev>`,
        to: customer.email,
        subject: `Invoice for ${job.job_type || "your recent job"}`,
        html: `
          <p>Hi ${customer.name},</p>
          <p>Thanks for your business. Here's your invoice:</p>
          <p><strong>Job:</strong> ${job.job_type || "Plumbing work"}<br/>
          ${
            priceChanged
              ? `<strong>Originally quoted:</strong> £${quotedAmount.toFixed(2)}<br/>
          <strong>Final amount due:</strong> £${finalAmount.toFixed(2)} (adjusted to reflect the work carried out)<br/>`
              : `<strong>Amount due:</strong> £${finalAmount.toFixed(2)}<br/>`
          }
          <strong>Due date:</strong> ${dueDate.toDateString()}</p>
          <p>A PDF copy of this invoice is attached.</p>
          <p>Thanks,<br/>${settings.business_name}</p>
        `,
        attachments: [
          {
            filename: `invoice-${invoice.id.slice(0, 8)}.pdf`,
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

