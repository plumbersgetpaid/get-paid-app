import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { hashPassword, verifyPassword } from "../../../lib/password";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const form = await req.formData();
  const currentPassword = (form.get("currentPassword") || "").toString();
  const newPassword = (form.get("newPassword") || "").toString();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Fill in both password fields" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password needs to be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: freshMember } = await db
    .from("team_members")
    .select("password_hash")
    .eq("id", currentMember.id)
    .single();

  const currentPasswordOk = await verifyPassword(currentPassword, freshMember?.password_hash);
  if (!currentPasswordOk) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  const { error } = await db
    .from("team_members")
    .update({ password_hash: newHash })
    .eq("id", currentMember.id);

  if (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
