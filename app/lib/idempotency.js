import { supabaseAdmin } from "./supabaseClient";

// Retry protection for actions that must never run twice.
//
// The threat, reported directly by tradespeople about other apps: flaky
// signal makes an action half-send, the phone (or the person, hammering
// the button) retries, and the app "tears itself apart" - duplicate
// invoices, duplicate emails, duplicate bookings. The fix: the client
// generates a request_id per logical action and sends it with every
// attempt. The server claims the id atomically before acting; a second
// attempt hits the primary key and is answered with the same
// success-shaped response instead of being executed again.
//
// This is also the bedrock the offline outbox stands on: replaying a
// queue after reconnect is only safe if replays can't double-apply.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Claim the id. Returns:
//   { duplicate: true }              - this exact action already ran
//   { duplicate: false, claimed }    - proceed; `claimed` is true when an
//                                      id was recorded (false when the
//                                      client sent none - old pages)
export async function claimRequest(requestId, businessId, endpoint) {
  const id = (requestId || "").toString().trim();
  if (!UUID_RE.test(id)) return { duplicate: false, claimed: false };

  const db = supabaseAdmin();
  const { error } = await db.from("processed_requests").insert({
    request_id: id,
    business_id: businessId,
    endpoint,
  });

  if (!error) return { duplicate: false, claimed: true, id };
  if (error.code === "23505") {
    // The id exists - but only treat it as a duplicate if the ORIGINAL
    // claim came from this same business. Without this check, anyone who
    // learned (or poisoned) another tenant's request_id could silently
    // suppress that tenant's action, and probe which UUIDs exist across
    // the platform. On a cross-tenant collision the action proceeds
    // WITHOUT dedup (logged loudly) - losing retry protection for one
    // attacker-supplied id beats silently swallowing a real action.
    const { data: existing } = await db
      .from("processed_requests")
      .select("business_id")
      .eq("request_id", id)
      .maybeSingle();
    if (existing && existing.business_id === businessId) {
      return { duplicate: true, id };
    }
    console.error(
      `Idempotency: request_id collision across businesses (${endpoint}) - proceeding unclaimed`
    );
    return { duplicate: false, claimed: false };
  }

  // Table missing or transient failure: never block the user's action
  // over bookkeeping - proceed without dedup, but say so in the logs.
  console.error(`Idempotency claim failed (${endpoint}):`, error.message);
  return { duplicate: false, claimed: false };
}

// Release a claim when the action failed AFTER claiming - otherwise the
// user's legitimate retry would be refused as a "duplicate" of an action
// that never actually happened.
export async function releaseRequest(claim) {
  if (!claim?.claimed || !claim.id) return;
  const db = supabaseAdmin();
  const { error } = await db.from("processed_requests").delete().eq("request_id", claim.id);
  if (error) console.error("Idempotency release failed:", error.message);
}
