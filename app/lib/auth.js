import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseClient";

// Deliberately built on nothing but Node's own built-in crypto module and
// Next.js's own cookies API - no new npm packages. This keeps every piece
// of login something we can reason about directly, rather than depending
// on a library whose exact behaviour on this Next.js version we can't
// verify without internet access in this environment.

export const SESSION_COOKIE = "gp_session";
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

// Hashes a password with a random salt using scrypt (a memory-hard,
// purpose-built password hashing function, built into Node - not a
// generic fast hash like sha256, which would be unsafe for passwords).
// Stored as "salt:hash", both hex-encoded.
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString("hex"));
    });
  });
  return `${salt}:${hash}`;
}

// Verifies a password against a stored "salt:hash" value. Uses a
// constant-time comparison (timingSafeEqual) so that how long the check
// takes can't be used to guess the correct password one byte at a time.
export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const hashBuffer = Buffer.from(hash, "hex");
  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  if (derivedKey.length !== hashBuffer.length) return false;
  return crypto.timingSafeEqual(derivedKey, hashBuffer);
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is not set - required for login to work. Add it in Vercel under Settings -> Environment Variables."
    );
  }
  return secret;
}

// Signs a value with HMAC-SHA256, so a session token can be verified just
// by checking its signature - no database lookup or separate sessions
// table needed to know whether a token is genuine and untampered with.
function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

// Builds a signed, self-contained session token: teamMemberId + expiry
// timestamp + a signature covering both. Anyone can read the ID and
// expiry (it's just a cookie), but nobody can forge or alter one without
// knowing SESSION_SECRET, which only this server has.
export function buildSessionToken(teamMemberId) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${teamMemberId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

// Verifies a session token's format, signature, and expiry. Returns the
// team member ID only if every check passes - never trusts any part of
// the token's content until the signature itself has been confirmed.
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [teamMemberId, expiresStr, signature] = parts;
  const payload = `${teamMemberId}.${expiresStr}`;

  let expectedSignature;
  try {
    expectedSignature = sign(payload);
  } catch (e) {
    console.error("Session token verification error:", e);
    return null;
  }

  let sigBuffer, expectedBuffer;
  try {
    sigBuffer = Buffer.from(signature, "hex");
    expectedBuffer = Buffer.from(expectedSignature, "hex");
  } catch {
    return null;
  }

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  const expires = Number(expiresStr);
  if (!expires || Number.isNaN(expires) || Date.now() > expires) return null;

  return teamMemberId;
}

// Reads the session cookie (if any), verifies it, and returns the
// logged-in team member's full database record - or null if there's no
// session, an invalid one, or the account no longer exists. Safe to call
// from any Server Component or Route Handler; only ever reads cookies,
// never writes them (writing is only allowed inside Route Handlers).
export async function getCurrentTeamMember() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const teamMemberId = verifySessionToken(token);
  if (!teamMemberId) return null;

  const db = supabaseAdmin();
  const { data } = await db
    .from("team_members")
    .select("*")
    .eq("id", teamMemberId)
    .eq("is_active", true)
    .maybeSingle();

  return data || null;
}
