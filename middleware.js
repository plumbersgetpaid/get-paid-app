import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./app/lib/auth";

// These must stay reachable without a session - otherwise nobody could
// ever reach the login page itself, the one-time owner setup page, or
// the auth API routes those two pages submit to in order to log in.
const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/api/auth/login",
  "/api/auth/setup",
  "/api/auth/logout",
];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;

    // Deliberately only checks the token's signature and expiry here, not
    // a database lookup on every single request - that keeps every page
    // load fast. The fuller check (does this account still exist, is it
    // still active) already happens separately wherever
    // getCurrentTeamMember() is used. One known, accepted gap from this:
    // if an account is ever deactivated in the future, someone already
    // holding a valid signed token for it could still pass this specific
    // check until that token's own 30-day expiry - worth tightening
    // if/when removing someone's access becomes a real, used feature.
    const teamMemberId = token ? await verifySessionToken(token) : null;

    if (!teamMemberId) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
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
