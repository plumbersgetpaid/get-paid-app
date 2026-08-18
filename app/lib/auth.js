import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseClient";

export const SESSION_COOKIE = "gp_session";
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

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

async function sign(value) {
  const key = await importSigningKey();
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return toHex(signatureBuffer);
}

export async function buildSessionToken(teamMemberId, sessionVersion = 0) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  // Version is part of the signed payload. Bumping team_members.session_version
  // (on any password change) makes every token carrying the old number fail
  // the version check its holder runs after loading the member.
  const payload = `${teamMemberId}.${expires}.${sessionVersion}`;
  return `${payload}.${await sign(payload)}`;
}

// Returns { teamMemberId, sessionVersion } on a valid signature+expiry, or
// null. It does NOT check the version against the database (it has no DB
// access and runs in the Edge proxy too) - the caller compares
// sessionVersion against the loaded member's current session_version.
export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");

  let teamMemberId, expiresStr, sessionVersion, signature, payload;
  if (parts.length === 4) {
    [teamMemberId, expiresStr, sessionVersion, signature] = parts;
    payload = `${teamMemberId}.${expiresStr}.${sessionVersion}`;
  } else if (parts.length === 3) {
    // Legacy token issued before versioning. Treated as version 0, which
    // matches the column default, so existing logins keep working until
    // they expire or a password change bumps the version past 0.
    [teamMemberId, expiresStr, signature] = parts;
    sessionVersion = "0";
    payload = `${teamMemberId}.${expiresStr}`;
  } else {
    return null;
  }

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

  return { teamMemberId, sessionVersion: Number(sessionVersion) };
}

export async function getCurrentTeamMember() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const verified = await verifySessionToken(token);
  if (!verified) return null;

  const db = supabaseAdmin();
  const { data } = await db
    .from("team_members")
    .select("*")
    .eq("id", verified.teamMemberId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;

  // A token minted before the last password change carries an older
  // session_version and is no longer valid, even though its signature and
  // expiry are fine.
  if ((data.session_version ?? 0) !== verified.sessionVersion) return null;

  return data;
}
