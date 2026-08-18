import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./app/lib/auth";
import { supabaseAdmin } from "./app/lib/supabaseClient";
import { hasAccess } from "./app/lib/stripe";
import {
  canInvoice,
  canSeeClientDatabase,
  canCreateQuote,
  canCreateJob,
  canCreateRecurringJob,
  canReschedule,
  isPlatformAdmin,
} from "./app/lib/permissions";

const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/setup",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/cron",
  "/api/billing/webhook",
];

const PERMISSION_GATED_PATHS = [
  { test: (p) => p === "/jobs/new" || p.startsWith("/jobs/new/"), check: canCreateQuote },
  {
    test: (p) => p === "/calendar/quick-book" || p.startsWith("/calendar/quick-book/"),
    check: canCreateJob,
  },
  {
    test: (p) => p === "/jobs/recurring" || p.startsWith("/jobs/recurring/"),
    check: canCreateRecurringJob,
  },
  { test: (p) => /^\/jobs\/schedule\/[^/]+$/.test(p), check: canReschedule },
  { test: (p) => /^\/jobs\/complete\/[^/]+$/.test(p), check: canInvoice },
  { test: (p) => p === "/clients/new" || p.startsWith("/clients/new/"), check: canSeeClientDatabase },
  { test: (p) => /^\/clients\/[^/]+\/edit$/.test(p), check: canSeeClientDatabase },
  { test: (p) => p === "/admin" || p.startsWith("/admin/"), check: isPlatformAdmin },
];

function matchesAny(pathname, list) {
  return list.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Every redirect this middleware issues goes through here, so none of
// them can ever be cached by a browser. A single Cache-Control header
// alone turned out not to be enough - this is a known, documented
// difficulty with Next.js middleware redirects specifically, not
// something unique to this app. Several redundant signals are set
// together for the best chance of actually being respected: the
// standard modern header, the classic legacy pair many caches still
// honour even when they don't fully respect Cache-Control alone, and
// Next.js/Vercel's own internal signal for this exact situation.
//
// This closes a real, hours-long bug: a genuinely correct redirect to
// /login (from an actual, temporary session problem earlier) got
// cached by a browser, and kept being silently replayed afterwards
// straight from disk cache - even once the real problem was long fixed
// and the live session was completely valid again, since the browser
// never asked the server a second time to find that out.
function redirectNoCache(url) {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("x-middleware-cache", "no-cache");
  return res;
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  if (matchesAny(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const teamMemberId = token ? await verifySessionToken(token) : null;

    if (!teamMemberId) {
      const loginUrl = new URL("/login", req.url);
      return redirectNoCache(loginUrl);
    }

    const db = supabaseAdmin();
    const { data: member } = await db
      .from("team_members")
      .select(
        "id, role, business_id, can_invoice, can_see_client_database, can_create_quote, can_create_job, can_create_recurring_job, can_reschedule, is_platform_admin"
      )
      .eq("id", teamMemberId)
      .eq("is_active", true)
      .maybeSingle();

    if (!member) {
      const loginUrl = new URL("/login", req.url);
      const res = redirectNoCache(loginUrl);
      res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }

    const matchedGate = PERMISSION_GATED_PATHS.find((g) => g.test(pathname));
    if (matchedGate && !matchedGate.check(member)) {
      return redirectNoCache(new URL("/", req.url));
    }

    // Billing gate. Once a trial has run out with nothing set up, the
    // app stops - but only for the screens that do the work. Billing,
    // settings, the account page and logging out all stay reachable,
    // because locking someone out of the page where they'd pay is a
    // good way to never get paid.
    const billingExempt =
      pathname.startsWith("/billing") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/account") ||
      pathname.startsWith("/api/billing") ||
      pathname.startsWith("/api/auth");

    if (!billingExempt) {
      const { data: sub } = await db
        .from("subscriptions")
        .select("status, trial_ends_at")
        .eq("business_id", member.business_id)
        .maybeSingle();

      // No row at all means a business created before billing existed -
      // those keep working rather than being locked out by a migration.
      if (sub && !hasAccess(sub)) {
        return redirectNoCache(new URL("/billing", req.url));
      }
    }

    return NextResponse.next();
  } catch (e) {
    console.error("Middleware error:", e);
    const loginUrl = new URL("/login", req.url);
    return redirectNoCache(loginUrl);
  }
}

export const config = {
  // Excludes Next's own static/image internals, plus any request that's
  // clearly a static asset by its file extension (icons, images) -
  // these should never need a session check at all.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp)$).*)"],
};
