import { supabaseAdmin } from "./supabaseClient";

// Per-IP throttle for the login and forgot-password endpoints.
//
// There was previously nothing: a scripted dictionary run against a known
// tradesperson email (their address is on every invoice they send) had
// unlimited attempts. This is a first layer, not a defence against a
// botnet - it keys on IP, which a distributed attacker can rotate, but it
// stops the realistic opportunistic case cheaply and, unlike an
// email-keyed lockout, can't be used to lock a real user out of their
// own account.
const MAX_ATTEMPTS = 10; // failures within the window before lock-out
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Call before checking the password. Returns { blocked, retryAfterMs }.
export async function checkLoginAllowed(req) {
  const ip = clientIp(req);
  const db = supabaseAdmin();
  const { data: row } = await db
    .from("login_attempts")
    .select("attempts, window_started_at, locked_until")
    .eq("ip", ip)
    .maybeSingle();

  if (row?.locked_until && new Date(row.locked_until) > new Date()) {
    return { blocked: true, retryAfterMs: new Date(row.locked_until) - new Date(), ip };
  }
  return { blocked: false, ip };
}

// Call after a FAILED attempt. Increments within the window and locks out
// once the threshold is crossed.
export async function recordFailedLogin(ip) {
  const db = supabaseAdmin();
  const now = new Date();
  const { data: row } = await db
    .from("login_attempts")
    .select("attempts, window_started_at")
    .eq("ip", ip)
    .maybeSingle();

  const windowFresh = row && now - new Date(row.window_started_at) < WINDOW_MS;
  const attempts = (windowFresh ? row.attempts : 0) + 1;
  const patch = {
    ip,
    attempts,
    window_started_at: windowFresh ? row.window_started_at : now.toISOString(),
    locked_until: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS).toISOString() : null,
  };
  const { error } = await db.from("login_attempts").upsert(patch, { onConflict: "ip" });
  if (error) console.error("recordFailedLogin failed:", error.message);
}

// Call after a SUCCESSFUL attempt - clears the counter for that IP.
export async function clearLoginAttempts(ip) {
  const db = supabaseAdmin();
  await db.from("login_attempts").delete().eq("ip", ip);
}

export const LOCKOUT_MINUTES = LOCKOUT_MS / 60000;
