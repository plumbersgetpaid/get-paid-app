import { supabaseAdmin } from "../../../lib/supabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.error("Chase quote lookup error:", jobErr);
    return NextResponse.redirect(new URL("/", req.url));
  }

  const { data: customer } = await db
    .from("customers")
    .select("*")
    .eq("id", job.customer_id)
    .single();

  if (customer?.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: "Get Paid <onboarding@resend.dev>",
        to: customer.email,
        subject: "Following up on your quote",
        html: `
          <p>Hi ${customer.name},</p>
          <p>Just checking in on the quote we sent for ${job.job_type || "your job"} (£${job.amount}). Let us know if you'd like to go ahead, or if you have any questions.</p>
          <p>Thanks,<br/>Your Plumber</p>
        `,
      });

      await db
        .from("jobs")
        .update({ quote_chased_at: new Date().toISOString() })
        .eq("id", job.id);
    } catch (e) {
      console.error("Chase quote send error:", e);
    }
  } else {
    console.log("Skipped chasing quote - no email on file or Resend key missing");
  }

  return NextResponse.redirect(new URL("/", req.url));
}
