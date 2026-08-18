import { getCurrentTeamMember } from "../../../../lib/auth";
import { canSeeEverything } from "../../../../lib/permissions";
import { canAccessReminder } from "../../../../lib/reminderAccess";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

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

  const db = await getScopedDb(currentMember);

  const { data: existing } = await db
    .from("personal_events")
    .select("*")
    .eq("id", reminderId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  const hasAccess = await canAccessReminder(db, existing, currentMember.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(start.getTime() + durationValue * 60 * 60 * 1000);

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

  const isCreatorOwnerManager = existing.created_by === currentMember.id && canSeeEverything(currentMember);
  if (isCreatorOwnerManager) {
    const desiredSharedIds = form.getAll("sharedWith").filter(Boolean);
    const { data: existingShares } = await db
      .from("reminder_shares")
      .select("team_member_id")
      .eq("reminder_id", reminderId);
    const currentSet = new Set((existingShares || []).map((s) => s.team_member_id));
    const desiredSet = new Set(desiredSharedIds);
    const toAdd = [...desiredSet].filter((id) => !currentSet.has(id));
    const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));

    if (toRemove.length > 0) {
      await db
        .from("reminder_shares")
        .delete()
        .eq("reminder_id", reminderId)
        .in("team_member_id", toRemove);
    }
    if (toAdd.length > 0) {
      const { error: addErr } = await db.from("reminder_shares").insert(
        toAdd.map((teamMemberId) => ({
          reminder_id: reminderId,
          team_member_id: teamMemberId,
          business_id: currentMember.business_id,
        }))
      );
      if (addErr) {
        console.error("Reminder share update error:", addErr);
      }
    }
  }

  return NextResponse.redirect(new URL("/calendar", req.url), 303);
}
