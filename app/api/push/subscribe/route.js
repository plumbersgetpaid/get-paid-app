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

  // The server later POSTs to this endpoint via web-push. Without a check,
  // a logged-in member could store endpoint:"http://169.254.169.254/..."
  // and turn every push send into a request to an internal URL of their
  // choosing (SSRF). Constrain to https on the known push-service hosts -
  // the only places a real browser subscription ever points.
  const PUSH_HOSTS = [
    "android.googleapis.com",
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "web.push.apple.com",
    "notify.windows.com", // *.notify.windows.com
  ];
  let host;
  try {
    const u = new URL(endpoint);
    host = u.hostname;
    if (u.protocol !== "https:") throw new Error("not https");
  } catch {
    return NextResponse.json({ error: "Invalid subscription endpoint" }, { status: 400 });
  }
  const hostAllowed = PUSH_HOSTS.some((h) => host === h || host.endsWith("." + h));
  if (!hostAllowed) {
    console.error("Push subscribe: rejected non-push endpoint host", host);
    return NextResponse.json({ error: "Unsupported push endpoint" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Cap rows per member so junk subscriptions can't accumulate unbounded
  // (dead ones are otherwise only pruned when a send returns 404/410). Only
  // a genuinely NEW endpoint counts against the cap - a re-subscribe of an
  // existing device just upserts, so a real user with a handful of devices
  // refreshing their subscription never hits this.
  const { data: existingRow } = await db
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (!existingRow) {
    const { count } = await db
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("team_member_id", currentMember.id);
    if ((count || 0) >= 20) {
      console.error("Push subscribe: member at subscription cap", currentMember.id);
      return NextResponse.json({ error: "Too many registered devices" }, { status: 429 });
    }
  }
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
