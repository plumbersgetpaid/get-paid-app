import { supabaseAdmin } from "./supabaseClient";

// Job photos and note images are pictures taken inside customers' homes.
// They used to be served from public buckets via getPublicUrl(), which
// produces a permanent, unauthenticated link - anyone holding it could
// view the image forever, with no login and no way to revoke it. These
// helpers replace that with links that expire.
//
// Signing runs on the admin client because creating a signed URL needs
// storage permissions the scoped client doesn't carry. That means the
// *caller* is responsible for having already established that this person
// may see this job - every call site below sits behind canAccessJob(),
// a permission gate, or the proxy. Signing does not authorise; it only
// hands out a short-lived link to something already authorised.

// An hour: long enough to browse a gallery, refresh, and come back to the
// tab, short enough that a link pasted somewhere it shouldn't be goes
// dead the same morning.
const BROWSE_TTL = 60 * 60;

// Minutes, for a PDF being generated right now - the URL is fetched
// server-side within the same request and never reaches a browser.
const RENDER_TTL = 5 * 60;

export { BROWSE_TTL, RENDER_TTL };

// Signs many paths in one round trip. Returns a Map of path -> signed URL.
// A path that fails to sign is simply absent, so callers should treat a
// missing entry as "no image" rather than rendering a broken one.
export async function signPaths(bucket, paths, expiresIn = BROWSE_TTL) {
  const wanted = [...new Set((paths || []).filter(Boolean))];
  if (wanted.length === 0) return new Map();

  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(bucket).createSignedUrls(wanted, expiresIn);

  if (error) {
    console.error(`Signing ${bucket} URLs failed:`, error);
    return new Map();
  }

  const byPath = new Map();
  for (const entry of data || []) {
    if (entry?.signedUrl && !entry.error) byPath.set(entry.path, entry.signedUrl);
  }
  return byPath;
}

// Attaches a freshly signed URL to each row, reading the storage path from
// pathKey and writing to urlKey. Overwrites whatever stale public URL the
// row was carrying, so old rows and new rows behave identically.
export async function withSignedUrls(bucket, rows, pathKey, urlKey, expiresIn = BROWSE_TTL) {
  const list = rows || [];
  const signed = await signPaths(
    bucket,
    list.map((r) => r?.[pathKey]),
    expiresIn
  );
  return list.map((r) => ({ ...r, [urlKey]: signed.get(r?.[pathKey]) || null }));
}
