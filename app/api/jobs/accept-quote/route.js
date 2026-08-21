import { getCurrentTeamMember } from "../../../lib/auth";
import { canAccessJob } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { formatAmountForTemplate } from "../../../lib/formatCurrency";
import { depositHowToPay } from "../../../lib/deposit";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { logEmailSent } from "../../../lib/logEmail";
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

  // Gate on access to THIS job, like complete and schedule do. Without it
  // any logged-in member - including a subcontractor with no permissions
  // and no assignment - could accept or decline any quote in the business;
  // a wrongful decline reads to the owner as the customer walking away.
  const { data: jobForCheck } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  const hasAccess = await canAccessJob(db, jobForCheck, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { error } = await db
    .from("jobs")
    .update({ status: "in_progress", accepted_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error("Accept quote error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Acceptance is the trigger for the deposit request: the quote only
  // STATED the deposit; now the customer has said yes, ask for it. Sent
  // once (deposit_requested_at guards a re-accept), best-effort - a failed
  // email must not undo the acceptance; "Chase deposit" on the job page
  // covers a resend.
  const deposit = Number(jobForCheck?.deposit_amount);
  if (Number.isFinite(deposit) && deposit > 0 && !jobForCheck.deposit_requested_at && process.env.RESEND_API_KEY) {
    try {
      const { data: customer } = await db
        .from("customers")
        .select("id, name, email")
        .eq("id", jobForCheck.customer_id)
        .single();

      if (customer?.email) {
        const settings = await getBusinessSettings();
        const template = await getTemplate("deposit_request");
        const balance = Math.round((Number(jobForCheck.amount) - deposit) * 100) / 100;
        const vars = {
          customer_name: customer.name,
          job_type: jobForCheck.job_type || "your job",
          deposit_amount: formatAmountForTemplate(deposit, settings.currency),
          balance_amount: formatAmountForTemplate(balance, settings.currency),
          business_name: settings.business_name,
        };
        const subject = renderTemplate(template.subject, vars) || "Deposit to secure your booking";
        // How to pay: the per-job payment link pasted at quote time
        // and/or bank details from Settings (falls back to "reply to
        // this email" if neither exists).
        const bodyText = renderTemplate(template.body, vars) + depositHowToPay(settings, jobForCheck.deposit_payment_link);
        const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(bodyText)}</div>`;

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: getEmailFrom(settings.business_name),
          to: customer.email,
          replyTo: settings.contact_email || undefined,
          subject,
          html,
        });

        const { error: stampErr } = await db
          .from("jobs")
          .update({ deposit_requested_at: new Date().toISOString() })
          .eq("id", jobId);
        if (stampErr) {
          console.error("Deposit request sent but stamp failed", jobId, stampErr.message);
        }
        await logEmailSent({
          businessId: currentMember.business_id,
          jobId,
          customerId: customer.id,
          to: customer.email,
          kind: "deposit_request",
          subject,
        });
      }
    } catch (e) {
      console.error("Deposit request email failed (acceptance stands):", e);
    }
  }

  return NextResponse.redirect(new URL("/", req.url), 303);
}
