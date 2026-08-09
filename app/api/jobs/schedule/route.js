import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const startDate = form.get("startDate");
  const startTime = form.get("startTime");
  const durationValue = parseFloat(form.get("durationValue") || "2");
  const durationUnit = form.get("durationUnit") || "hours";
  const durationHours = durationUnit === "days" ? durationValue * 24 : durationValue;
  const force = form.get("force") === "1";

  if (!jobId || !startDate || !startTime) {
    return NextResponse.json({ error: "Missing scheduling details" }, { status: 400 });
  }

  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  const db = supabaseAdmin();

  if (!force) {
    // Look for another in-progress job whose scheduled time overlaps this one
    const { data: others } = await db
      .from("jobs")
      .select("id, job_type, customer_id, scheduled_start, scheduled_end")
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null)
      .neq("id", jobId);

    const conflict = (others || []).find((o) => {
      const oStart = new Date(o.scheduled_start);
      const oEnd = new Date(o.scheduled_end);
      return start < oEnd && end > oStart;
    });

    if (conflict) {
      const { data: conflictCustomer } = await db
        .from("customers")
        .select("name")
        .eq("id", conflict.customer_id)
        .single();

      const redirectUrl = new URL(`/jobs/schedule/${jobId}`, req.url);
      redirectUrl.searchParams.set("startDate", startDate);
      redirectUrl.searchParams.set("startTime", startTime);
      redirectUrl.searchParams.set("durationValue", String(durationValue));
      redirectUrl.searchParams.set("durationUnit", durationUnit);
      redirectUrl.searchParams.set(
        "conflict",
        `This overlaps with ${conflictCustomer?.name || "another job"} (${
          conflict.job_type || "job"
        }) already booked at that time.`
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  const { error } = await db
    .from("jobs")
    .update({
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      reminder_sent_at: null, // reset so the day-before reminder fires for the new time
    })
    .eq("id", jobId);

  if (error) {
    console.error("Schedule save error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
