import { supabaseAdmin } from "../../../lib/supabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");

  const db = supabaseAdmin();

  // 1. Mark the job complete
  const { data: job, error: jobErr } = await db
    .from("jobs")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("*, customers(*)")
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 400 });
  }

  // 2. Create the invoice, due in 14 days
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .insert({
      job_id: job.id,
      amount: job.amount,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "unpaid",
    })
    .select()
    .single();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  await db.from("jobs").update({ status: "invoiced" }).eq("id", job.id);

  // 3. Send the invoice email
  if (job.customers?.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "invoices@yourbusiness.com", // replace with your verified sending domain
      to: job.customers.email,
      subject: `Invoice for ${job.job_type || "your recent job"}`,
      html: `
        <p>Hi ${job.customers.name},</p>
        <p>Thanks for your business. Here's your invoice:</p>
        <p><strong>Job:</strong> ${job.job_type || "Plumbing work"}<br/>
        <strong>Amount due:</strong> £${job.amount}<br/>
        <strong>Due date:</strong> ${dueDate.toDateString()}</p>
        <p>Thanks,<br/>Your Plumber</p>
      `,
    });

    await db.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", invoice.id);
  }

  // 4. Also send an SMS confirmation (optional - requires Twilio setup)
  // See README for enabling this.

  return NextResponse.redirect(new URL("/", req.url));
}
