import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const form = await req.formData();
  const name = (form.get("name") || "").toString().trim();

  if (!name) {
    return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("team_members")
    .update({ name })
    .eq("id", currentMember.id);

  if (error) {
    console.error("Update name error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, name });
}
