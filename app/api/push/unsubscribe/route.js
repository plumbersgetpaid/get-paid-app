import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { endpoint } = (await req.json().catch(() => ({}))) || {};
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const db = supabaseAdmin();
  // Scoped to this member so one person can't delete another's device.
  await db
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("team_member_id", currentMember.id);
  return NextResponse.json({ ok: true });
}
