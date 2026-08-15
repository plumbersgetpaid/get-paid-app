import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./app/lib/auth";
import { supabaseAdmin } from "./app/lib/supabaseClient";
import {
  canInvoice,
  canSeeClientDatabase,
  canCreateQuote,
  canCreateJob,
  canCreateRecurringJob,
  canReschedule,
} from "./app/lib/permissions";

// These must stay reachable without a session - otherwise nobody could
// ever reach the login page itself, the one-time owner setup page, or
// the auth API routes those two pages submit to in order to log in.
const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/setup",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

// Each path pattern is paired with the specific granular permission that
// governs it, rather than a single blanket "owner/manager only" list -
// this is what lets one specific subcontractor be granted access to just
// one of these individually, per the per-person permissions system.
// Every check function here is owner/manager-first internally (see
// permissions.js), so this list has no separate "but owners/managers are
// always allowed" logic of its own - that's handled once, centrally, by
// each check function itself.
//
// Scheduling and completing a job moved here from being scoped-access
// (a subcontractor could do these for their own assigned job) to a
// granular permission - a deliberate decision: by default subcontractors
// only view and add notes on their jobs, but a specific person can now
// be individually granted reschedule/invoicing ability.
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
];

function matchesAny(pathname, list) {
  return list.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (matchesAny(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const teamMemberId = token ? await verifySessionToken(token) : null;

    if (!teamMemberId) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Checks is_active, role, and now every granular permission column
    // on every request via a real DB lookup - previously this only
    // checked the token's own signature and expiry, which meant
    // deactivating someone didn't take effect until their token expired,
    // up to 30 days later. Deactivation is a real, used feature now, so
    // that gap is closed here even at the cost of one extra DB lookup
    // per request.
    const db = supabaseAdmin();
    const { data: member } = await db
      .from("team_members")
      .select(
        "id, role, can_invoice, can_see_client_database, can_create_quote, can_create_job, can_create_recurring_job, can_reschedule"
      )
      .eq("id", teamMemberId)
      .eq("is_active", true)
      .maybeSingle();

    if (!member) {
      const loginUrl = new URL("/login", req.url);
      const res = NextResponse.redirect(loginUrl);
      // Also clear the now-invalid cookie, so the browser stops sending
      // a token for an account that no longer has access
      res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }

    const matchedGate = PERMISSION_GATED_PATHS.find((g) => g.test(pathname));
    if (matchedGate && !matchedGate.check(member)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  } catch (e) {
    // Anything unexpected here fails safe - redirect to login rather
    // than let an uncaught error take down every page in the app at
    // once, which is a far worse outcome than an unnecessary redirect
    console.error("Middleware error:", e);
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  // Runs on every request except Next.js's own static/internal assets -
  // those don't carry any business data and don't need a login check
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
