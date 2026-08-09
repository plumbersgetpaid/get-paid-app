import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const reminderId = form.get("reminderId");
  const title = (form.get("title") || "").toString().trim();
  const notes = (form.get("notes") || "").toString().trim();
  const startDate = form.get("startDate");
  const startTime = form.get("startTime") || "09:00";
  const durationValue = parseFloat(form.get("durationValue") || "0.5");

  if (!reminderId || !title || !startDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(start.getTime() + durationValue * 60 * 60 * 1000);

  const db = supabaseAdmin();
  const { error } = await db
    .from("personal_events")
    .update({
      title,
      notes: notes || null,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
    })
    .eq("id", reminderId);

  if (error) {
    console.error("Update reminder error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
