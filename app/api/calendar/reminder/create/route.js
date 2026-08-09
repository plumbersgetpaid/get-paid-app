import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { computeScheduleEnd } from "../../../../lib/duration";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const title = (form.get("title") || "").toString().trim();
  const notes = (form.get("notes") || "").toString().trim();
  const startDate = form.get("startDate");
  const startTime = form.get("startTime") || "09:00";
  const durationValue = parseFloat(form.get("durationValue") || "0.5");
  const durationUnit = form.get("durationUnit") || "hours";
  const includeWeekends = form.get("includeWeekends") === "1";

  if (!title || !startDate) {
    return NextResponse.json({ error: "Missing title or date" }, { status: 400 });
  }

  const start = new Date(`${startDate}T${startTime}:00`);
  const end = computeScheduleEnd(start, durationValue, durationUnit, includeWeekends);

  const db = supabaseAdmin();
  const { error } = await db.from("personal_events").insert({
    title,
    notes: notes || null,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
  });

  if (error) {
    console.error("Create reminder error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
