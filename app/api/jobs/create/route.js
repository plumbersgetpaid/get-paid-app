import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
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
      const settings = await getBusinessSettings();
      const template = await getTemplate("quote");
      const vars = {
        customer_name: name,
        job_type: jobType || "Plumbing work",
        amount,
        business_name: settings.business_name,
      };
      const subject =
        renderTemplate(template.subject, vars) || `Quote for ${jobType || "your job"}`;
      const bodyText = renderTemplate(template.body, vars);
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${bodyText.replace(
        /\n/g,
        "<br/>"
      )}</div>`;

      await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: `${settings.business_name} <onboarding@resend.dev>`,
        to: email,
        subject,
        html,
      });
    } catch (e) {
      console.error("Quote email send error:", e);
    }
  } else {
    console.log("Skipped sending quote email - no email on file or Resend key missing");
  }

  return NextResponse.redirect(new URL("/", req.url));
}
