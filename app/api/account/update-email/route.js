import { getCurrentTeamMember } from "../../../lib/auth";
import { verifyPassword } from "../../../lib/password";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { buildSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../../../lib/auth";
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

  const db = await getScopedDb(currentMember);

  const { data: freshMember } = await db
    .from("team_members")
    .select("password_hash, session_version")
    .eq("id", currentMember.id)
    .single();

  const currentPasswordOk = await verifyPassword(currentPassword, freshMember?.password_hash);
  if (!currentPasswordOk) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  // Uniqueness check on the ADMIN client: email is globally unique across all
  // businesses (the DB constraint is global), but the scoped client only sees
  // the caller's own tenant, so a cross-business collision would slip past a
  // scoped check and surface as an opaque 500 on the constraint. Check the
  // whole table here for a clean, correct message.
  const admin = supabaseAdmin();
  const { data: existing } = await admin
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

  // Changing the login email is an account-takeover-relevant event (whoever
  // holds the new address controls password reset). Bump session_version to
  // log out every OTHER device - a stolen session that changes the email
  // shouldn't leave the victim's other sessions silently alive - then
  // re-issue THIS session's cookie so the person who made the change stays
  // logged in where they made it. Mirrors change-password.
  const newVersion = (freshMember.session_version ?? 0) + 1;
  const { error } = await db
    .from("team_members")
    .update({ email: newEmail, session_version: newVersion })
    .eq("id", currentMember.id);

  if (error) {
    console.error("Update email error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, email: newEmail });
  try {
    const token = await buildSessionToken(currentMember.id, newVersion);
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
  } catch (e) {
    console.error("Re-issue session after email change failed:", e);
  }
  return res;
}
