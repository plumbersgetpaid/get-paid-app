import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseClient";

// Password hashing still uses Node's built-in crypto module directly -
// that's fine, since it only ever runs inside Route Handlers (login,
// setup), which always run in the Node.js runtime on Vercel.
//
// Session token signing, below, deliberately uses the Web Crypto API
// (the global `crypto.subtle`) instead - identical standard, available
// in both the Node.js runtime AND the more restricted Edge runtime that
// Next.js middleware runs in by default. That matters because middleware
// is what checks login on every single page request; if it used
// something Edge doesn't support, the whole app could break at once.
// Verified these two produce byte-for-byte identical signatures before
// switching, so no one gets logged out by this change.

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

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function importSigningKey() {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Signs a value with HMAC-SHA256 via the Web Crypto API, so a session
// token can be verified just by checking its signature - no database
// lookup or separate sessions table needed to know whether a token is
// genuine and untampered with.
async function sign(value) {
  const key = await importSigningKey();
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return toHex(signatureBuffer);
}

// Builds a signed, self-contained session token: teamMemberId + expiry
// timestamp + a signature covering both. Anyone can read the ID and
// expiry (it's just a cookie), but nobody can forge or alter one without
// knowing SESSION_SECRET, which only this server has.
export async function buildSessionToken(teamMemberId) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${teamMemberId}.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

// Verifies a session token's format, signature, and expiry. Returns the
// team member ID only if every check passes - never trusts any part of
// the token's content until the signature itself has been confirmed.
// crypto.subtle.verify does the signature comparison in constant time
// internally, the same protection timingSafeEqual gave the old version.
export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [teamMemberId, expiresStr, signature] = parts;
  const payload = `${teamMemberId}.${expiresStr}`;

  const signatureBytes = fromHex(signature);
  if (!signatureBytes) return null;

  let valid;
  try {
    const key = await importSigningKey();
    const enc = new TextEncoder();
    valid = await crypto.subtle.verify("HMAC", key, signatureBytes, enc.encode(payload));
  } catch (e) {
    console.error("Session token verification error:", e);
    return null;
  }

  if (!valid) return null;

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

  const teamMemberId = await verifySessionToken(token);
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
