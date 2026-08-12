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

export async function buildSessionToken(teamMemberId) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${teamMemberId}.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

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
