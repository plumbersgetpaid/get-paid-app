import { supabaseAdmin } from "../../../lib/supabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");

  const db = supabaseAdmin();

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

  const { data: customer, error: custErr } = await db
    .from("customers")
    .select("*")
    .eq("id", job.customer_id)
    .single();

  if (custErr) {
    console.error("Customer lookup error:", custErr);
  }

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
    console.error("Invoice insert error:", invErr);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  await db.from("jobs").update({ status: "invoiced" }).eq("id", job.id);

  if (customer?.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const result = await resend.emails.send({
        from: "Get Paid <onboarding@resend.dev>",
        to: customer.email,
        subject: `Invoice for ${job.job_type || "your recent job"}`,
        html: `
          <p>Hi ${customer.name},</p>
          <p>Thanks for your business. Here's your invoice:</p>
          <p><strong>Job:</strong> ${job.job_type || "Plumbing work"}<br/>
          <strong>Amount due:</strong> £${job.amount}<br/>
          <strong>Due date:</strong> ${dueDate.toDateString()}</p>
          <p>Thanks,<br/>Your Plumber</p>
        `,
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

  return NextResponse.redirect(new URL("/", req.url));
}
