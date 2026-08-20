import { supabaseAdmin } from "../../../lib/supabaseClient";
import { hashPassword } from "../../../lib/password";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { NextResponse } from "next/server";
import { syncStripeSeats } from "../../../lib/syncStripeSeats";

const ALLOWED_ROLES = ["manager", "subcontractor"];

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const name = (form.get("name") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim().toLowerCase();
  const password = (form.get("password") || "").toString();
  const role = (form.get("role") || "").toString();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Please fill in every field" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password needs to be at least 8 characters" },
      { status: 400 }
    );
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const passwordHash = await hashPassword(password);

  // business_id is required. This runs on the admin client (RLS bypassed),
  // so nothing fills it in for us - omitting it created the member with a
  // NULL business_id: invisible to the scoped team list, and getScopedDb()
  // throws for them on login, 500-ing every page. Scope to the owner's own
  // business, the same as every other row this business creates.
  const { error } = await db.from("team_members").insert({
    name,
    email,
    password_hash: passwordHash,
    role,
    is_active: true,
    business_id: currentMember.business_id,
  });

  if (error) {
    console.error("Add team member error:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't create the account" }, { status: 500 });
  }

  // Seat count changed - keep the Stripe bill honest (never blocks).
  await syncStripeSeats(currentMember.business_id);

  return NextResponse.json({ ok: true });
}
