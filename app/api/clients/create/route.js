import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const name = (form.get("name") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const address = (form.get("address") || "").toString().trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("customers").insert({
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
  });

  if (error) {
    console.error("Create client error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/clients", req.url));
}
