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
  "/api/cron",
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
      res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }

    const matchedGate = PERMISSION_GATED_PATHS.find((g) => g.test(pathname));
    if (matchedGate && !matchedGate.check(member)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  } catch (e) {
    console.error("Middleware error:", e);
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
