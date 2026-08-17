import { supabaseAdmin } from "../../../lib/supabaseClient";
import { hashPassword } from "../../../lib/password";
import { buildSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../../../lib/auth";
import { NextResponse } from "next/server";

const TRIAL_DAYS = 14;

// Public signup - creates a brand new business on the platform.
//
// Deliberately separate from /api/auth/setup, which is hard-locked to
// run exactly once (it refuses if any team member exists at all). That
// was right when this was a single-business app; it's the wrong shape
// for a product other firms sign up to. This route can run any number
// of times, and every business it creates is isolated by its own
// business_id.
export async function POST(req) {
  const form = await req.formData();
  const name = (form.get("name") || "").toString().trim();
  const businessName = (form.get("businessName") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim().toLowerCase();
  const password = (form.get("password") || "").toString();
  const teamSizeRaw = parseInt((form.get("teamSize") || "1").toString(), 10);
  const teamSize = Number.isFinite(teamSizeRaw) && teamSizeRaw > 0 ? Math.min(teamSizeRaw, 500) : 1;

  if (!name || !businessName || !email || !password) {
    return NextResponse.json({ error: "Please fill in every field" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password needs to be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  // Emails identify a person across the whole platform, so a duplicate
  // has to be caught here rather than left to the unique constraint -
  // otherwise the failure reads as a generic server error and the
  // person has no idea they already have an account.
  const { data: existing } = await db
    .from("team_members")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "There's already an account with that email - try logging in instead" },
      { status: 400 }
    );
  }

  const businessId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  const { data: newMember, error: insertErr } = await db
    .from("team_members")
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: "owner",
      is_active: true,
      business_id: businessId,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("Signup insert error:", insertErr);
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "There's already an account with that email" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Couldn't create the account" }, { status: 500 });
  }

  // Seed their settings with the business name they gave us. Without
  // this the app falls back to a generic default, and their very first
  // quote would go out under the wrong name.
  const { error: settingsErr } = await db.from("business_settings").insert({
    business_id: businessId,
    business_name: businessName,
    contact_email: email,
  });
  if (settingsErr) {
    // Not fatal - getBusinessSettings falls back to defaults, so the
    // account still works and they can fix the name in Settings.
    console.error("Signup settings seed error:", settingsErr);
  }

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);

  const { error: subErr } = await db.from("subscriptions").insert({
    business_id: businessId,
    status: "trialing",
    seats: teamSize,
    trial_ends_at: trialEnds.toISOString(),
  });
  if (subErr) {
    console.error("Signup subscription create error:", subErr);
  }

  let token;
  try {
    token = await buildSessionToken(newMember.id);
  } catch (e) {
    console.error("Session build error during signup:", e);
    return NextResponse.json(
      {
        error:
          "Account created, but we couldn't log you in automatically - head to the login page and sign in with what you just set.",
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
