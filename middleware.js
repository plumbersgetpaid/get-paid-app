import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./app/lib/auth";
import { supabaseAdmin } from "./app/lib/supabaseClient";

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

const OWNER_MANAGER_ONLY_PATHS = [
  "/jobs/recurring",
  "/jobs/new",
  "/clients/new",
  "/calendar/quick-book",
];

const OWNER_MANAGER_ONLY_PATTERNS = [
  /^\/clients\/[^/]+\/edit$/,
  /^\/jobs\/schedule\/[^/]+$/,
  /^\/jobs\/complete\/[^/]+$/,
];

function matchesAny(pathname, list) {
  return list.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function matchesAnyPattern(pathname, patterns) {
  return patterns.some((re) => re.test(pathname));
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
      .select("id, role")
      .eq("id", teamMemberId)
      .eq("is_active", true)
      .maybeSingle();

    if (!member) {
      const loginUrl = new URL("/login", req.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }

    const showEverything = member.role === "owner" || member.role === "manager";
    const isProtectedPath =
      matchesAny(pathname, OWNER_MANAGER_ONLY_PATHS) ||
      matchesAnyPattern(pathname, OWNER_MANAGER_ONLY_PATTERNS);
    if (!showEverything && isProtectedPath) {
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
