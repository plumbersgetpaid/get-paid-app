import webpush from "web-push";
import { supabaseAdmin } from "./supabaseClient";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@getpatchup.co.uk";
  if (!pub || !priv) {
    console.error("Push not configured - VAPID public or private key missing");
    return false;
  }
  try {
    // setVapidDetails THROWS on a malformed key or a subject that isn't a
    // mailto:/https URL. Catch it so a bad env var degrades to "no push"
    // instead of 500-ing the whole cron.
    webpush.setVapidDetails(subject, pub, priv);
  } catch (e) {
    console.error("Push not configured - VAPID details rejected:", e.message);
    return false;
  }
  configured = true;
  return true;
}

// Sends one notification to every device a team member has enabled. A
// subscription that comes back 404/410 (the browser dropped it) is deleted,
// so dead devices don't accumulate. Returns { sent, removed }.
export async function sendPushToMember(teamMemberId, payload) {
  if (!ensureConfigured()) {
    console.error("Push not configured - VAPID keys missing");
    return { sent: 0, removed: 0 };
  }
  const db = supabaseAdmin();

  // A deactivated member keeps their push_subscriptions rows (toggle-active
  // only flips is_active), so without this guard a fired subcontractor's
  // personal phone keeps receiving job nudges carrying homeowner names and
  // addresses — a UK GDPR data-processor exposure. Gate every push on the
  // member still being active, here at the one choke point all sends pass
  // through rather than at each call site.
  const { data: member } = await db
    .from("team_members")
    .select("is_active")
    .eq("id", teamMemberId)
    .maybeSingle();
  if (!member?.is_active) {
    return { sent: 0, removed: 0 };
  }

  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("team_member_id", teamMemberId);

  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body
      );
      sent += 1;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("id", s.id);
        removed += 1;
      } else {
        console.error("Push send error:", e.statusCode, e.body || e.message);
      }
    }
  }
  return { sent, removed };
}
