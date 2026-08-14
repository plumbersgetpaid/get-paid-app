import { supabaseAdmin } from "../../../lib/supabaseClient";
import { hashPassword } from "../../../lib/password";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const token = (form.get("token") || "").toString();
  const newPassword = (form.get("newPassword") || "").toString();

  if (!token) {
    return NextResponse.json({ error: "Missing or invalid reset link" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password needs to be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { data: member } = await db
    .from("team_members")
    .select("id, reset_token_expires")
    .eq("reset_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!member || !member.reset_token_expires || new Date(member.reset_token_expires) < new Date()) {
    return NextResponse.json(
      { error: "This reset link has expired or already been used - request a new one" },
      { status: 400 }
    );
  }

  const newHash = await hashPassword(newPassword);
  const { error } = await db
    .from("team_members")
    .update({ password_hash: newHash, reset_token: null, reset_token_expires: null })
    .eq("id", member.id);

  if (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Couldn't save that - try again" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
