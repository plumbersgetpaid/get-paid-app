import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { computeScheduleEnd } from "../../../lib/duration";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canReschedule } from "../../../lib/permissions";
import { canAccessJob } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const startDate = form.get("startDate");
  const startTime = form.get("startTime");
  const durationValue = parseFloat(form.get("durationValue") || "2");
  const durationUnit = form.get("durationUnit") || "hours";
  const location = (form.get("location") || "").toString().trim();
  const includeWeekends = form.get("includeWeekends") === "1";
  const force = form.get("force") === "1";
  const notifyEmail = form.get("notifyEmail") === "1";

  if (!jobId || !startDate || !startTime) {
    return NextResponse.json({ error: "Missing scheduling details" }, { status: 400 });
  }

  const currentMember = await getCurrentTeamMember();
  if (!canReschedule(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const db = await getScopedDb(currentMember);

  const { data: jobForCheck } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", jobId)
    .maybeSingle();
  const hasAccess = await canAccessJob(db, jobForCheck, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const settings = await getBusinessSettings();
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = computeScheduleEnd(start, durationValue, durationUnit, includeWeekends);

  if (!force) {
    const { data: others } = await db
      .from("jobs")
      .select("id, job_type, customer_id, scheduled_start, scheduled_end")
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null)
      .neq("id", jobId);

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

      const redirectUrl = new URL(`/jobs/schedule/${jobId}`, req.url);
      redirectUrl.searchParams.set("startDate", startDate);
      redirectUrl.searchParams.set("startTime", startTime);
      redirectUrl.searchParams.set("durationValue", String(durationValue));
      redirectUrl.searchParams.set("durationUnit", durationUnit);
      redirectUrl.searchParams.set("location", location);
      redirectUrl.searchParams.set("includeWeekends", includeWeekends ? "1" : "0");
      redirectUrl.searchParams.set("conflict", conflictMessage);
      return NextResponse.redirect(redirectUrl);
    }
  }

  const { data: updatedJob, error } = await db
    .from("jobs")
    .update({
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      location: location || null,
      time_confirmed: true,
      reminder_sent_at: null,
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (error) {
    console.error("Schedule save error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (notifyEmail && updatedJob) {
    const { data: customer } = await db
      .from("customers")
      .select("*")
      .eq("id", updatedJob.customer_id)
      .single();

    if (customer) {
      const template = await getTemplate("booking_confirmation");
      const vars = {
        customer_name: customer.name,
        job_type: updatedJob.job_type || "your job",
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

      if (notifyEmail && customer.email && process.env.RESEND_API_KEY) {
        try {
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
        } catch (e) {
          console.error("Booking confirmation email error:", e);
        }
      }
    }
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
