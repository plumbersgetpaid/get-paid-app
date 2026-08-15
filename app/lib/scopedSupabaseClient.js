import { createClient } from "@supabase/supabase-js";

function getJwtSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "SUPABASE_JWT_SECRET environment variable is not set. Find it in Supabase under Settings -> API -> JWT Secret, and add it in Vercel under Settings -> Environment Variables."
    );
  }
  return secret;
}

function base64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importSigningKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signScopedJwt({ teamMemberId, businessId }) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: "authenticated",
    sub: teamMemberId,
    business_id: businessId,
    iat: now,
    exp: now + 300,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importSigningKey(getJwtSecret());
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  const encodedSignature = base64url(new Uint8Array(signatureBuffer));

  return `${signingInput}.${encodedSignature}`;
}

export async function getScopedDb(currentMember) {
  if (!currentMember?.id || !currentMember?.business_id) {
    throw new Error(
      "getScopedDb() called without a valid currentMember.business_id - the caller must confirm someone is logged in before requesting a scoped client."
    );
  }

  const token = await signScopedJwt({
    teamMemberId: currentMember.id,
    businessId: currentMember.business_id,
  });

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
