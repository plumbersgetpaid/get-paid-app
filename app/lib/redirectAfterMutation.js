import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Redirect back to a list after changing something on it.
//
// Three separate caches can each serve a stale page after a mutation, and
// fixing only one of them leaves the bug looking intermittent:
//
//   1. Next's own cache for the path - revalidatePath() clears it, and
//      also drops the client-side router cache entry on the next
//      navigation. Nothing in this app called it before, which is why a
//      newly created recurring job needed a manual refresh to appear.
//   2. The browser's HTTP cache, which will happily replay a redirect and
//      its destination from disk without asking the server. Same failure
//      the proxy's redirectNoCache() was written for.
//   3. The back/forward cache, handled separately by <ReloadOnBack /> on
//      the pages that need it.
//
// 303 rather than the NextResponse.redirect() default of 307: 307 keeps
// the method, so the browser re-POSTs and the history entry stays a POST,
// which is what made Back offer to resubmit the form.
export function redirectAfterMutation(req, path) {
  revalidatePath(path);

  const res = NextResponse.redirect(new URL(path, req.url), 303);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}
