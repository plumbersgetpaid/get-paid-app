import { getCurrentTeamMember } from "../../../lib/auth";
import { hashPassword, verifyPassword } from "../../../lib/password";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { buildSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../../../lib/auth";
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

  const newHash = await hashPassword(newPassword);
  const newVersion = (freshMember.session_version ?? 0) + 1;
  // Bump the version to log out other devices, then re-issue THIS session's
  // cookie at the new version so the person who just changed their password
  // isn't kicked out of the tab they did it in.
  const { error } = await db
    .from("team_members")
    .update({ password_hash: newHash, session_version: newVersion })
    .eq("id", currentMember.id);

  if (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
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
    console.error("Re-issue session after password change failed:", e);
  }
  return res;
}
