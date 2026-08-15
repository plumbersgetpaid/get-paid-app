import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

const ALLOWED_ROLES = ["manager", "subcontractor"];

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const memberId = form.get("memberId");
  const newRole = (form.get("role") || "").toString();

  if (!memberId || !ALLOWED_ROLES.includes(newRole)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (memberId === currentMember.id) {
    return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { data: target } = await db
    .from("team_members")
    .select("role")
    .eq("id", memberId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "That account no longer exists" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner's role can't be changed" }, { status: 400 });
  }

  const { error } = await db
    .from("team_members")
    .update({ role: newRole })
    .eq("id", memberId);

  if (error) {
    console.error("Update role error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
