import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const key = form.get("key");
  const subject = (form.get("subject") || "").toString();
  const body = (form.get("body") || "").toString();

  if (!key || !body.trim()) {
    return NextResponse.json({ error: "Missing key or body" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("message_templates").upsert({
    key,
    subject,
    body,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Save template error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
