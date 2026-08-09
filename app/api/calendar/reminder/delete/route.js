import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const reminderId = form.get("reminderId");

  if (!reminderId) {
    return NextResponse.json({ error: "Missing reminderId" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("personal_events").delete().eq("id", reminderId);

  if (error) {
    console.error("Delete reminder error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
