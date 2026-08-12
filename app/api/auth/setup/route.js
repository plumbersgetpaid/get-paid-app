import { supabaseAdmin } from "../../../lib/supabaseClient";
import { hashPassword } from "../../../lib/password";
import { buildSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const name = (form.get("name") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim().toLowerCase();
  const password = (form.get("password") || "").toString();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Please fill in every field" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password needs to be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { count, error: countErr } = await db
    .from("team_members")
    .select("id", { count: "exact", head: true });

  if (countErr) {
    console.error("Setup count check error:", countErr);
    return NextResponse.json({ error: "Couldn't check setup status" }, { status: 500 });
  }
  if (count && count > 0) {
    return NextResponse.json(
      { error: "Setup has already been completed - use the login page instead" },
      { status: 403 }
    );
  }

  const passwordHash = await hashPassword(password);

  const { data: newMember, error: insertErr } = await db
    .from("team_members")
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: "owner",
      is_active: true,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("Setup insert error:", insertErr);
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't create the account" }, { status: 500 });
  }

  let token;
  try {
    token = await buildSessionToken(newMember.id);
  } catch (e) {
    console.error("Session build error during setup:", e);
    return NextResponse.json(
      {
        error:
          "Account created, but couldn't log you in automatically - go to the login page and sign in with what you just set.",
      },
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
