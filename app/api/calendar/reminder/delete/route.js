import { getCurrentTeamMember } from "../../../../lib/auth";
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

  if (!reminderId) {
    return NextResponse.json({ error: "Missing reminderId" }, { status: 400 });
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

  const { error } = await db.from("personal_events").delete().eq("id", reminderId);

  if (error) {
    console.error("Delete reminder error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
