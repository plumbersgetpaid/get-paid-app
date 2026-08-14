import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { verifyPassword } from "../../../lib/password";
import { NextResponse } from "next/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const form = await req.formData();
  const newEmail = (form.get("newEmail") || "").toString().trim().toLowerCase();
  const currentPassword = (form.get("currentPassword") || "").toString();

  if (!newEmail || !EMAIL_PATTERN.test(newEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!currentPassword) {
    return NextResponse.json({ error: "Enter your current password to confirm" }, { status: 400 });
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

  const { data: existing } = await db
    .from("team_members")
    .select("id")
    .ilike("email", newEmail)
    .neq("id", currentMember.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "That email is already in use by another account" },
      { status: 400 }
    );
  }

  const { error } = await db
    .from("team_members")
    .update({ email: newEmail })
    .eq("id", currentMember.id);

  if (error) {
    console.error("Update email error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: newEmail });
}
