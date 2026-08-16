import { getCurrentTeamMember } from "../../../lib/auth";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { formatCurrency } from "../../../lib/formatCurrency";
import { getEmailFrom } from "../../../lib/emailFrom";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

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
      const settings = await getBusinessSettings();
      const bodyText = `Hi ${customer.name},\n\nJust checking in on the quote we sent for ${
        job.job_type || "your job"
      } (${formatCurrency(job.amount, settings.currency)}). Let us know if you'd like to go ahead, or if you have any questions.\n\nThanks,\n${
        settings.business_name
      }`;
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}</div>`;

      await resend.emails.send({
        from: getEmailFrom(settings.business_name),
        to: customer.email,
        replyTo: settings.contact_email || undefined,
        subject: "Following up on your quote",
        html,
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
