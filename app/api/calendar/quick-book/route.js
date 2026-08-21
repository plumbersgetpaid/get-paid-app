import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { toStoredAmount } from "../../../lib/vat";
import { logEmailSent } from "../../../lib/logEmail";
import { parseDeposit, depositHowToPay } from "../../../lib/deposit";
import { sanitizePaymentLink } from "../../../lib/paymentLink";
import { validAssigneeIds } from "../../../lib/jobAccess";
import { formatCurrency } from "../../../lib/formatCurrency";
import { computeScheduleEnd } from "../../../lib/duration";
import { narrowToRealClashes } from "../../../lib/jobConflicts";
import { findExistingCustomer } from "../../../lib/findCustomer";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canCreateJob } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { claimRequest, releaseRequest } from "../../../lib/idempotency";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canCreateJob(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const customerName = (form.get("customerName") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const jobType = (form.get("jobType") || "").toString().trim();
  const location = (form.get("location") || "").toString().trim();
  const amountInput = (form.get("amount") || "").toString().trim();
  const assignedToIds = form.getAll("assignedTo").filter(Boolean);
  const startDate = form.get("startDate");
  const startTime = form.get("startTime");
  const durationValue = parseFloat(form.get("durationValue") || "2");
  const durationUnit = form.get("durationUnit") || "hours";
  const includeWeekends = form.get("includeWeekends") === "1";
  const force = form.get("force") === "1";
  const notifyEmail = form.get("notifyEmail") === "1";

  if (!customerName || !startDate || !startTime) {
    return NextResponse.json(
      { error: "Missing customer name or scheduling details" },
      { status: 400 }
    );
  }

  const settings = await getBusinessSettings();
  const grossAmount = amountInput ? toStoredAmount(amountInput, settings) : 0;
  // Deposit is the literal £ the customer sends, validated against the
  // gross total (needs a known price - no deposit on a blank amount).
  const deposit = grossAmount > 0 ? parseDeposit(form, grossAmount) : null;
  const depositPaymentLink = deposit !== null ? sanitizePaymentLink(form.get("depositPaymentLink")) : null;
  if (deposit !== null && !depositPaymentLink && !settings.bank_details) {
    return NextResponse.json(
      { error: "Add a payment link for the deposit, or save your bank details in Settings first - the customer needs a way to pay." },
      { status: 400 }
    );
  }
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = computeScheduleEnd(start, durationValue, durationUnit, includeWeekends);

  const db = await getScopedDb(currentMember);

  if (!force) {
    const { data: others } = await db
      .from("jobs")
      .select("id, job_type, customer_id, scheduled_start, scheduled_end")
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null);

    const overlapping = (others || []).filter((o) => {
      const oStart = new Date(o.scheduled_start);
      const oEnd = new Date(o.scheduled_end);
      return start < oEnd && end > oStart;
    });

    // Only a clash if whoever this job is being assigned to is already
    // expected somewhere else at that time.
    const conflicts = await narrowToRealClashes(db, overlapping, assignedToIds);

    if (conflicts.length > 0) {
      const conflictCustomerIds = [...new Set(conflicts.map((c) => c.customer_id))];
      const { data: conflictCustomers } = await db
        .from("customers")
        .select("id, name")
        .in("id", conflictCustomerIds);
      const conflictNameById = Object.fromEntries(
        (conflictCustomers || []).map((c) => [c.id, c.name])
      );

      const describeConflict = (c) => {
        const name = conflictNameById[c.customer_id] || "another customer";
        const date = new Date(c.scheduled_start).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });
        return `${name} (${c.job_type || "job"}, ${date})`;
      };

      const conflictMessage =
        conflicts.length === 1
          ? `This overlaps with ${describeConflict(conflicts[0])} already booked at that time.`
          : `This overlaps with ${conflicts.length} jobs already booked in that period: ${conflicts
              .map(describeConflict)
              .join(", ")}.`;

      const redirectUrl = new URL("/calendar/quick-book", req.url);
      redirectUrl.searchParams.set("customerName", customerName);
      redirectUrl.searchParams.set("phone", phone);
      redirectUrl.searchParams.set("email", email);
      redirectUrl.searchParams.set("jobType", jobType);
      redirectUrl.searchParams.set("location", location);
      redirectUrl.searchParams.set("amount", amountInput);
      redirectUrl.searchParams.set("startDate", startDate);
      redirectUrl.searchParams.set("startTime", startTime);
      redirectUrl.searchParams.set("durationValue", String(durationValue));
      redirectUrl.searchParams.set("durationUnit", durationUnit);
      redirectUrl.searchParams.set("includeWeekends", includeWeekends ? "1" : "0");
      redirectUrl.searchParams.set("conflict", conflictMessage);
      return NextResponse.redirect(redirectUrl, 303);
    }
  }

  // Retry protection: a resend of this exact action - flaky signal,
  // double-tap, browser resubmit, offline replay - is answered with the
  // success response instead of running twice. See lib/idempotency.js.
  const claim = await claimRequest(form.get("request_id"), currentMember.business_id, "quick-book");
  if (claim.duplicate) {
    return NextResponse.redirect(new URL("/calendar", req.url), 303);
  }

  const existingCustomer = await findExistingCustomer(db, {
    name: customerName,
    email,
    phone,
  });

  let customerId;
  let customerEmail = email || null;
  let customerPhone = phone || null;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    const updates = {};
    if (!existingCustomer.phone && phone) updates.phone = phone;
    if (!existingCustomer.email && email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      await db.from("customers").update(updates).eq("id", customerId);
    }
    customerEmail = existingCustomer.email || email || null;
    customerPhone = existingCustomer.phone || phone || null;
  } else {
    const { data: newCustomer, error: custErr } = await db
      .from("customers")
      .insert({
        name: customerName,
        phone: phone || null,
        email: email || null,
        business_id: currentMember.business_id,
      })
      .select()
      .single();

    if (custErr) {
      console.error("Quick-book customer insert error:", custErr);
      await releaseRequest(claim);
      return NextResponse.json({ error: custErr.message }, { status: 400 });
    }
    customerId = newCustomer.id;
  }

  const { data: newJob, error: jobErr } = await db
    .from("jobs")
    .insert({
      customer_id: customerId,
      job_type: jobType || null,
      location: location || null,
      // toStoredAmount adds VAT for 'exclusive'-mode businesses; the raw
      // input above stays raw so the clash-warning redirect re-fills the
      // form with exactly what was typed.
      amount: grossAmount,
      // Quick-book IS acceptance, so a deposit here is requested straight
      // away (in the booking email below). Spread keeps the insert valid
      // pre-migration.
      ...(deposit !== null
        ? { deposit_amount: deposit, deposit_requested_at: new Date().toISOString() }
        : {}),
      ...(depositPaymentLink ? { deposit_payment_link: depositPaymentLink } : {}),
      status: "in_progress",
      accepted_at: new Date().toISOString(),
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      created_by: currentMember?.id || null,
      assigned_to: null,
      business_id: currentMember.business_id,
    })
    .select()
    .single();

  if (jobErr) {
    console.error("Quick-book job insert error:", jobErr);
    await releaseRequest(claim);
    return NextResponse.json({ error: jobErr.message }, { status: 400 });
  }

  if (assignedToIds.length > 0 && newJob) {
    const validIds = await validAssigneeIds(db, assignedToIds);
    if (validIds.length > 0) {
      const { error: sharesErr } = await db.from("job_shares").insert(
        validIds.map((teamMemberId) => ({
          job_id: newJob.id,
          team_member_id: teamMemberId,
          business_id: currentMember.business_id,
        }))
      );
      if (sharesErr) {
        console.error("Quick-book assign error:", sharesErr);
      }
    }
  }

  if (notifyEmail) {
    const template = await getTemplate("booking_confirmation");
    const vars = {
      customer_name: customerName,
      job_type: jobType || "your job",
      start_date: start.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      start_time: startTime,
      duration: `${durationValue} ${durationUnit}`,
      business_name: settings.business_name,
    };
    let bodyText = renderTemplate(template.body, vars);
    // Quick-book is already an accepted job, so the deposit is asked for
    // right here in the booking confirmation (bank details attached -
    // there's no invoice, and so no payment link, yet).
    if (deposit !== null) {
      bodyText += `\n\nTo secure your booking, please send the deposit of ${formatCurrency(
        deposit,
        settings.currency
      )}. The remaining ${formatCurrency(
        Math.round((grossAmount - deposit) * 100) / 100,
        settings.currency
      )} is due on completion.${depositHowToPay(settings, depositPaymentLink)}`;
    }
    const subject = renderTemplate(template.subject, vars) || "Booking confirmed";

    if (notifyEmail && customerEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
          bodyText
        )}</div>`;
        await resend.emails.send({
          from: getEmailFrom(settings.business_name),
          to: customerEmail,
          replyTo: settings.contact_email || undefined,
          subject,
          html,
        });
        await logEmailSent({
          businessId: currentMember.business_id,
          jobId: newJob.id,
          customerId,
          to: customerEmail,
          kind: "booking_confirmation",
          subject,
        });
      } catch (e) {
        console.error("Booking confirmation email error:", e);
      }
    }
  }

  return NextResponse.redirect(new URL("/calendar", req.url), 303);
}
