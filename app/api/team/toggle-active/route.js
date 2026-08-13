import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const memberId = form.get("memberId");
  const isActive = form.get("isActive") === "1";

  if (!memberId) {
    return NextResponse.json({ error: "Missing memberId" }, { status: 400 });
  }

  if (memberId === currentMember.id) {
    return NextResponse.json(
      { error: "You can't deactivate your own account" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: target } = await db
    .from("team_members")
    .select("role")
    .eq("id", memberId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "That account no longer exists" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner's access can't be removed" }, { status: 400 });
  }

  const { error } = await db
    .from("team_members")
    .update({ is_active: isActive })
    .eq("id", memberId);

  if (error) {
    console.error("Toggle active error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
