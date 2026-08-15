import { createClient } from "@supabase/supabase-js";

function getSigningJwk() {
  const raw = process.env.SUPABASE_JWT_SIGNING_KEY;
  if (!raw) {
    throw new Error(
      "SUPABASE_JWT_SIGNING_KEY environment variable is not set - required for RLS-scoped queries to work. Add it in Vercel under Settings -> Environment Variables."
    );
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("SUPABASE_JWT_SIGNING_KEY is not valid JSON - check it was pasted in full.");
  }
}

function base64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["sign"], ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function signScopedJwt({ teamMemberId, businessId }) {
  const jwk = getSigningJwk();
  const header = { alg: "ES256", kid: jwk.kid, typ: "JWT" };
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

  const privateKey = await importPrivateKey(jwk);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
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
