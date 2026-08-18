import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { NextResponse } from "next/server";

// Stores (or refreshes) this device's push subscription for the logged-in
// member. Endpoint is unique, so re-subscribing upserts.
export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const sub = await req.json().catch(() => null);
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("push_subscriptions").upsert(
    {
      business_id: currentMember.business_id,
      team_member_id: currentMember.id,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: "Couldn't save subscription" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
