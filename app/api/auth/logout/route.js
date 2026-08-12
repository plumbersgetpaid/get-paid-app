import { SESSION_COOKIE } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
