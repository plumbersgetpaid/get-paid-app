import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../../lib/auth";
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

  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("personal_events")
    .select("created_by")
    .eq("id", reminderId)
    .maybeSingle();

  if (!existing || existing.created_by !== currentMember.id) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  const { error } = await db.from("personal_events").delete().eq("id", reminderId);

  if (error) {
    console.error("Delete reminder error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
