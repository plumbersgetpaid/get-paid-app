import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { vatBreakdown, toStoredAmount } from "../../../lib/vat";
import { formatCurrency, formatAmountForTemplate } from "../../../lib/formatCurrency";
import { computeScheduleEnd } from "../../../lib/duration";
import { findExistingCustomer } from "../../../lib/findCustomer";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canCreateQuote } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { claimRequest, releaseRequest } from "../../../lib/idempotency";
import { logEmailSent } from "../../../lib/logEmail";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canCreateQuote(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const form = await req.formData();
  const name = form.get("name");
  const phone = form.get("phone");
  const email = form.get("email");
  const jobType = form.get("jobType");
  const amountRaw = form.get("amount");
  const assignedToIds = form.getAll("assignedTo").filter(Boolean);
  const location = (form.get("location") || "").toString().trim();
  const proposedDate = form.get("proposedDate");
  const proposedTime = form.get("proposedTime") || "09:00";
  const durationValue = form.get("durationValue");
  const durationUnit = form.get("durationUnit") || "hours";
  const includeWeekends = form.get("includeWeekends") === "1";

  const db = await getScopedDb(currentMember);
  const settings = await getBusinessSettings();

  // Businesses that quote "£500 + VAT" (vat_price_entry = 'exclusive') type
  // the before-VAT figure; the app adds VAT here, once, on the way in.
  // Storage stays VAT-inclusive everywhere.
  const amount = amountRaw ? toStoredAmount(amountRaw, settings) : amountRaw;

  // Retry protection: a resend of this exact action - flaky signal,
  // double-tap, browser resubmit, offline replay - is answered with the
  // success response instead of running twice. See lib/idempotency.js.
  const claim = await claimRequest(form.get("request_id"), currentMember.business_id, "jobs/create");
  if (claim.duplicate) {
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  const existingCustomer = await findExistingCustomer(db, { name, email, phone });

  let customer;
  if (existingCustomer) {
    customer = existingCustomer;
    const updates = {};
    if (!existingCustomer.phone && phone) updates.phone = phone;
    if (!existingCustomer.email && email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      await db.from("customers").update(updates).eq("id", customer.id);
      customer = { ...customer, ...updates };
    }
  } else {
    const { data: newCustomer, error: custErr } = await db
      .from("customers")
      .insert({ name, phone, email, business_id: currentMember.business_id })
      .select()
      .single();

    if (custErr) {
      console.error("Customer insert error:", custErr);
      await releaseRequest(claim);
      return NextResponse.json({ error: custErr.message }, { status: 400 });
    }
    customer = newCustomer;
  }

  let scheduledStart = null;
  let scheduledEnd = null;
  if (proposedDate && durationValue) {
    const start = new Date(`${proposedDate}T${proposedTime}:00`);
    scheduledStart = start.toISOString();
    scheduledEnd = computeScheduleEnd(
      start,
      parseFloat(durationValue),
      durationUnit,
      includeWeekends
    ).toISOString();
  }

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .insert({
      customer_id: customer.id,
      job_type: jobType,
      location: location || null,
      amount: amount ? parseFloat(amount) : 0,
      status: "quote_sent",
      quote_sent_at: new Date().toISOString(),
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      created_by: currentMember?.id || null,
      assigned_to: null,
      business_id: currentMember.business_id,
    })
    .select()
    .single();

  if (jobErr) {
    console.error("Job insert error:", jobErr);
    await releaseRequest(claim);
    return NextResponse.json({ error: jobErr.message }, { status: 400 });
  }

  if (assignedToIds.length > 0 && job) {
    const { error: sharesErr } = await db.from("job_shares").insert(
      assignedToIds.map((teamMemberId) => ({
        job_id: job.id,
        team_member_id: teamMemberId,
        business_id: currentMember.business_id,
      }))
    );
    if (sharesErr) {
      console.error("New quote assign error:", sharesErr);
    }
  }

  if (email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const template = await getTemplate("quote");
      const vars = {
        customer_name: name,
        job_type: jobType || "Work carried out",
        // Bare formatted number ("1,880.40") - the template writes the £.
        // Raw numbers rendered "1880.4" in real customer emails.
        amount: formatAmountForTemplate(amount, settings.currency),
        business_name: settings.business_name,
      };
      const subject =
        renderTemplate(template.subject, vars) || `Quote for ${jobType || "your job"}`;
      let bodyText = renderTemplate(template.body, vars);
      if (location) {
        bodyText += `\n\nJob location: ${location}`;
      }
      // A VAT-registered business shows the customer that the quoted total
      // already includes VAT (amounts in the app are VAT-inclusive).
      if (settings.vat_registered) {
        const vat = vatBreakdown(amount, settings.vat_rate ?? 20);
        if (vat) {
          bodyText += `\n\nThe quoted price includes VAT at ${vat.rate}% (${formatCurrency(
            vat.vat,
            settings.currency
          )}).${settings.vat_number ? ` VAT No: ${settings.vat_number}` : ""}`;
        }
      }
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}</div>`;

      await resend.emails.send({
        from: getEmailFrom(settings.business_name),
        to: email,
        replyTo: settings.contact_email || undefined,
        subject,
        html,
      });
      await logEmailSent({
        businessId: currentMember.business_id,
        jobId: job.id,
        customerId: customer.id,
        to: email,
        kind: "quote",
        subject,
      });
    } catch (e) {
      console.error("Quote email send error:", e);
    }
  } else {
    console.log("Skipped sending quote email - no email on file or Resend key missing");
  }

  return NextResponse.redirect(new URL("/", req.url), 303);
}
