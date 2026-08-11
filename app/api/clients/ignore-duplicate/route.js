import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const customerId = form.get("customerId");
  const dupeId = form.get("dupeId");

  if (!customerId || !dupeId) {
    return NextResponse.json({ error: "Missing customer IDs" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("ignored_duplicates").insert({
    customer_id_a: customerId,
    customer_id_b: dupeId,
  });

  if (error) {
    console.error("Ignore duplicate error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
