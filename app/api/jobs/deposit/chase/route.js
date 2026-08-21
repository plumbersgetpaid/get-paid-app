import { getCurrentTeamMember } from "../../../../lib/auth";
import { canInvoice } from "../../../../lib/permissions";
import { canAccessJob } from "../../../../lib/jobAccess";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import { getBusinessSettings } from "../../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../../lib/getTemplate";
import { formatAmountForTemplate } from "../../../../lib/formatCurrency";
import { depositHowToPay } from "../../../../lib/deposit";
import { textToEmailHtml } from "../../../../lib/emailHtml";
import { getEmailFrom } from "../../../../lib/emailFrom";
import { logEmailSent } from "../../../../lib/logEmail";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Manual deposit reminder - deliberately NOT automatic: an unpaid deposit
// often means "not going ahead", and auto-nagging someone before any work
// is done reads very differently from chasing money owed for finished work.
export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const { data: job } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!job.deposit_amount || job.deposit_received_on) {
    return NextResponse.json({ error: "Nothing to chase - no deposit outstanding" }, { status: 400 });
  }

  const { data: customer } = await db
    .from("customers")
    .select("id, name, email")
    .eq("id", job.customer_id)
    .single();
  if (!customer?.email || !process.env.RESEND_API_KEY) {
    return NextResponse.redirect(new URL(`/jobs/view/${jobId}`, req.url), 303);
  }

  try {
    const settings = await getBusinessSettings();
    const template = await getTemplate("deposit_chase");
    const vars = {
      customer_name: customer.name,
      job_type: job.job_type || "your job",
      deposit_amount: formatAmountForTemplate(job.deposit_amount, settings.currency),
      business_name: settings.business_name,
    };
    const subject = renderTemplate(template.subject, vars) || "Deposit reminder";
    const bodyText = renderTemplate(template.body, vars) + depositHowToPay(settings, job.deposit_payment_link);
    const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(bodyText)}</div>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: getEmailFrom(settings.business_name),
      to: customer.email,
      replyTo: settings.contact_email || undefined,
      subject,
      html,
    });
    await logEmailSent({
      businessId: currentMember.business_id,
      jobId,
      customerId: customer.id,
      to: customer.email,
      kind: "deposit_chase",
      subject,
    });
  } catch (e) {
    console.error("Deposit chase send error:", e);
  }

  return NextResponse.redirect(new URL(`/jobs/view/${jobId}`, req.url), 303);
}
