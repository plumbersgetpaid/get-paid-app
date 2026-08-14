import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { computeScheduleEnd } from "../../../../lib/duration";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canSeeEverything } from "../../../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const form = await req.formData();
  const title = (form.get("title") || "").toString().trim();
  const notes = (form.get("notes") || "").toString().trim();
  const startDate = form.get("startDate");
  const startTime = form.get("startTime") || "09:00";
  const durationValue = parseFloat(form.get("durationValue") || "0.5");
  const durationUnit = form.get("durationUnit") || "hours";
  const includeWeekends = form.get("includeWeekends") === "1";
  const sharedWithIds = canSeeEverything(currentMember)
    ? form.getAll("sharedWith").filter(Boolean)
    : [];

  if (!title || !startDate) {
    return NextResponse.json({ error: "Missing title or date" }, { status: 400 });
  }

  const start = new Date(`${startDate}T${startTime}:00`);
  const end = computeScheduleEnd(start, durationValue, durationUnit, includeWeekends);

  const db = supabaseAdmin();
  const { data: newReminder, error } = await db
    .from("personal_events")
    .insert({
      title,
      notes: notes || null,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      created_by: currentMember.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Create reminder error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (sharedWithIds.length > 0 && newReminder) {
    const { error: sharesErr } = await db
      .from("reminder_shares")
      .insert(sharedWithIds.map((teamMemberId) => ({ reminder_id: newReminder.id, team_member_id: teamMemberId })));
    if (sharesErr) {
      console.error("Reminder share error:", sharesErr);
    }
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
