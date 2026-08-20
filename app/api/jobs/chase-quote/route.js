import { getCurrentTeamMember } from "../../../lib/auth";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { formatCurrency } from "../../../lib/formatCurrency";
import { getEmailFrom } from "../../../lib/emailFrom";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { claimRequest, releaseRequest } from "../../../lib/idempotency";
import { logEmailSent } from "../../../lib/logEmail";

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

  // Retry protection: a resend of this exact action - flaky signal,
  // double-tap, browser resubmit, offline replay - is answered with the
  // success response instead of running twice. See lib/idempotency.js.
  const claim = await claimRequest(form.get("request_id"), currentMember.business_id, "chase-quote");
  if (claim.duplicate) {
    return NextResponse.redirect(new URL("/", req.url), 303);
  }


  const db = await getScopedDb(currentMember);

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.error("Chase quote lookup error:", jobErr);
    return NextResponse.redirect(new URL("/", req.url), 303);
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

      await logEmailSent({
        businessId: currentMember.business_id,
        jobId: job.id,
        customerId: customer.id,
        to: customer.email,
        kind: "quote_chase",
        subject: "Following up on your quote",
      });

      // quote_chased_at is the UI's "already chased" signal. If this stamp
      // is lost silently the follow-up looks un-sent, inviting the user to
      // chase again — a duplicate follow-up email to the homeowner. The
      // email is already out; make a lost stamp loud.
      const { error: stampErr } = await db
        .from("jobs")
        .update({ quote_chased_at: new Date().toISOString() })
        .eq("id", job.id);
      if (stampErr) {
        console.error("Chase quote: email sent but quote_chased_at stamp FAILED", job.id, stampErr);
      }
    } catch (e) {
      console.error("Chase quote send error:", e);
    }
  } else {
    console.log("Skipped chasing quote - no email on file or Resend key missing");
  }

  return NextResponse.redirect(new URL("/", req.url), 303);
}
