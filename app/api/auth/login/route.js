import { supabaseAdmin } from "../../../lib/supabaseClient";
import { verifyPassword } from "../../../lib/password";
import { buildSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../../../lib/auth";
import {
  checkLoginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
  LOCKOUT_MINUTES,
} from "../../../lib/loginThrottle";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const email = (form.get("email") || "").toString().trim().toLowerCase();
  const password = (form.get("password") || "").toString();

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  }

  // Throttle before touching the password path, so a locked-out IP can't
  // keep guessing.
  const gate = await checkLoginAllowed(req);
  if (gate.blocked) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in about ${LOCKOUT_MINUTES} minutes.` },
      { status: 429 }
    );
  }

  const db = supabaseAdmin();
  const { data: member, error } = await db
    .from("team_members")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Login lookup error:", error);
    return NextResponse.json({ error: "Something went wrong - try again" }, { status: 500 });
  }

  const genericError = { error: "Incorrect email or password" };

  if (!member || !member.is_active) {
    await recordFailedLogin(gate.ip);
    return NextResponse.json(genericError, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, member.password_hash);
  if (!passwordOk) {
    await recordFailedLogin(gate.ip);
    return NextResponse.json(genericError, { status: 401 });
  }

  await clearLoginAttempts(gate.ip);

  let token;
  try {
    token = await buildSessionToken(member.id, member.session_version ?? 0);
  } catch (e) {
    console.error("Session build error during login:", e);
    return NextResponse.json(
      { error: "Login is misconfigured on the server - contact whoever manages this app" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
