import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { sendWhatsAppMessage } from "../../../lib/sendWhatsApp";
import { computeScheduleEnd } from "../../../lib/duration";
import { findExistingCustomer } from "../../../lib/findCustomer";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canCreateJob } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

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
  const notifyWhatsapp = form.get("notifyWhatsapp") === "1";

  if (!customerName || !startDate || !startTime) {
    return NextResponse.json(
      { error: "Missing customer name or scheduling details" },
      { status: 400 }
    );
  }

  const settings = await getBusinessSettings();
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = computeScheduleEnd(start, durationValue, durationUnit, includeWeekends);

  const db = await getScopedDb(currentMember);

  if (!force) {
    const { data: others } = await db
      .from("jobs")
      .select("id, job_type, customer_id, scheduled_start, scheduled_end")
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null);

    const conflicts = (others || []).filter((o) => {
      const oStart = new Date(o.scheduled_start);
      const oEnd = new Date(o.scheduled_end);
      return start < oEnd && end > oStart;
    });

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
      return NextResponse.redirect(redirectUrl);
    }
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
      amount: amountInput ? parseFloat(amountInput) : 0,
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
    return NextResponse.json({ error: jobErr.message }, { status: 400 });
  }

  if (assignedToIds.length > 0 && newJob) {
    const { error: sharesErr } = await db.from("job_shares").insert(
      assignedToIds.map((teamMemberId) => ({
        job_id: newJob.id,
        team_member_id: teamMemberId,
        business_id: currentMember.business_id,
      }))
    );
    if (sharesErr) {
      console.error("Quick-book assign error:", sharesErr);
    }
  }

  if (notifyEmail || notifyWhatsapp) {
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
    const bodyText = renderTemplate(template.body, vars);
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
      } catch (e) {
        console.error("Booking confirmation email error:", e);
      }
    }

    if (notifyWhatsapp && customerPhone) {
      await sendWhatsAppMessage(customerPhone, bodyText);
    }
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
