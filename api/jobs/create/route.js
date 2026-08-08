import { supabaseAdmin } from "../../../lib/supabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const name = form.get("name");
  const phone = form.get("phone");
  const email = form.get("email");
  const jobType = form.get("jobType");
  const amount = form.get("amount");

  const db = supabaseAdmin();

  const { data: customer, error: custErr } = await db
    .from("customers")
    .insert({ name, phone, email })
    .select()
    .single();

  if (custErr) {
    console.error("Customer insert error:", custErr);
    return NextResponse.json({ error: custErr.message }, { status: 400 });
  }

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .insert({
      customer_id: customer.id,
      job_type: jobType,
      amount: amount ? parseFloat(amount) : 0,
      status: "quote_sent",
      quote_sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobErr) {
    console.error("Job insert error:", jobErr);
    return NextResponse.json({ error: jobErr.message }, { status: 400 });
  }

  // Send the quote email
  if (email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: "Get Paid <onboarding@resend.dev>",
        to: email,
        subject: `Quote for ${jobType || "your job"}`,
        html: `
          <p>Hi ${name},</p>
          <p>Thanks for the opportunity to quote for your job. Here are the details:</p>
          <p><strong>Job:</strong> ${jobType || "Plumbing work"}<br/>
          <strong>Quoted price:</strong> £${amount}</p>
          <p>Let us know if you'd like to go ahead and we'll get it booked in.</p>
          <p>Thanks,<br/>Your Plumber</p>
        `,
      });
    } catch (e) {
      console.error("Quote email send error:", e);
    }
  } else {
    console.log("Skipped sending quote email - no email on file or Resend key missing");
  }

  return NextResponse.redirect(new URL("/", req.url));
}
