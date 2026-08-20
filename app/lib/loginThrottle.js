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
//
// Two things this file is careful about, both from the audit:
//   1. login and forgot-password get SEPARATE counters (via `scope`). If
//      they shared one, ten bad logins would disable the documented
//      recovery path exactly when it's needed, and a flood of reset
//      requests from a shared office/NAT IP would lock everyone out of
//      login. The key stored is `${scope}:${ip}`.
//   2. Counting is done by an ATOMIC database function, not a
//      select-then-write in JS. The old read-modify-write let a burst of
//      parallel guesses all read the same low count and overwrite each
//      other, so the counter never reached the threshold - the exact
//      attack the throttle exists to stop. See supabase/login-throttle.sql.
const MAX_ATTEMPTS = 10; // failures within the window before lock-out
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Call before checking the password. `scope` separates the login and
// password-reset counters. Returns { blocked, retryAfterMs, ip, key } -
// pass the returned `key` to recordFailedLogin / clearLoginAttempts.
export async function checkLoginAllowed(req, scope = "login") {
  const ip = clientIp(req);
  const key = `${scope}:${ip}`;
  const db = supabaseAdmin();
  const { data: row } = await db
    .from("login_attempts")
    .select("locked_until")
    .eq("ip", key)
    .maybeSingle();

  if (row?.locked_until && new Date(row.locked_until) > new Date()) {
    return { blocked: true, retryAfterMs: new Date(row.locked_until) - new Date(), ip, key };
  }
  return { blocked: false, ip, key };
}

// Call after a FAILED attempt. Atomic increment + lock in one DB statement
// (supabase/login-throttle.sql). The function also self-purges rows older
// than a day, so IP addresses aren't retained indefinitely.
export async function recordFailedLogin(key) {
  const db = supabaseAdmin();
  const { error } = await db.rpc("record_login_attempt", {
    p_key: key,
    p_window_ms: WINDOW_MS,
    p_max_attempts: MAX_ATTEMPTS,
    p_lockout_ms: LOCKOUT_MS,
  });
  if (error) console.error("recordFailedLogin failed:", error.message);
}

// Call after a SUCCESSFUL attempt - clears the counter for that key.
export async function clearLoginAttempts(key) {
  const db = supabaseAdmin();
  await db.from("login_attempts").delete().eq("ip", key);
}

export const LOCKOUT_MINUTES = LOCKOUT_MS / 60000;
