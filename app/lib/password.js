import crypto from "crypto";

// Password hashing - uses Node's built-in crypto module directly. This
// is deliberately kept in its own file, separate from auth.js. This file
// must ONLY ever be imported by Route Handlers (login, setup), which
// always run in the Node.js runtime on Vercel. It must NEVER be imported
// by middleware, or by anything middleware itself imports - middleware
// runs in the more restricted Edge runtime, which cannot load Node's
// crypto module at all. Even an unused import of it in a file middleware
// pulls in is enough to break every request middleware handles.

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
