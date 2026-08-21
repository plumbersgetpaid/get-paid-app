import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canInvoice } from "../../../lib/permissions";
import { canAccessInvoice } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { claimRequest, releaseRequest } from "../../../lib/idempotency";
import { logEmailSent } from "../../../lib/logEmail";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const invoiceId = form.get("invoiceId");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  // Retry protection: a resend of this exact action - flaky signal,
  // double-tap, browser resubmit, offline replay - is answered with the
  // success response instead of running twice. See lib/idempotency.js.
  const claim = await claimRequest(form.get("request_id"), currentMember.business_id, "mark-paid");
  if (claim.duplicate) {
    return NextResponse.redirect(new URL("/", req.url), 303);
  }


  const db = await getScopedDb(currentMember);

  // Per-job gate: a subcontractor with can_invoice may only mark their OWN
  // jobs' invoices paid (matches how completing a job is gated). Without it,
  // marking any invoice paid stops its chasing and fires a review email.
  if (!(await canAccessInvoice(db, invoiceId, currentMember))) {
    await releaseRequest(claim);
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("job_id")
    .single();

  if (invErr) {
    console.error("Mark paid error:", invErr);
    await releaseRequest(claim);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  if (invoice?.job_id) {
    const { error: jobErr } = await db.from("jobs").update({ status: "paid" }).eq("id", invoice.job_id);
    if (jobErr) {
      // The invoice is already marked paid above - a silent failure here
      // leaves job and invoice disagreeing about money.
      console.error(`Invoice ${invoice.id} paid but job ${invoice.job_id} status update failed:`, jobErr);
    }
  }

  if (invoice?.job_id) {
    try {
      const settings = await getBusinessSettings();
      if (settings.google_review_link) {
        const { data: job } = await db
          .from("jobs")
          .select("customer_id")
          .eq("id", invoice.job_id)
          .single();

        const { data: customer } = job?.customer_id
          ? await db.from("customers").select("*").eq("id", job.customer_id).single()
          : { data: null };

        if (customer) {
          const template = await getTemplate("review_request");
          const vars = {
            customer_name: customer.name,
            business_name: settings.business_name,
            review_link: settings.google_review_link,
          };
          const bodyText = renderTemplate(template.body, vars);
          const subject = renderTemplate(template.subject, vars) || "Thanks for your payment!";

          if (customer.email && process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
              bodyText
            )}</div>`;
            await resend.emails.send({
              from: getEmailFrom(settings.business_name),
              to: customer.email,
              replyTo: settings.contact_email || undefined,
              subject,
              html,
            });
            await logEmailSent({
              businessId: currentMember.business_id,
              jobId: invoice.job_id,
              customerId: customer.id,
              to: customer.email,
              kind: "review_request",
              subject,
            });
          }
        }
      }
    } catch (e) {
      console.error("Review request send error:", e);
    }
  }

  return NextResponse.redirect(new URL("/", req.url), 303);
}
