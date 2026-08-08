import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const file = form.get("logo");

  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.redirect(new URL("/settings?error=nologo", req.url));
  }

  const db = supabaseAdmin();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from("logos")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: true });

  if (uploadError) {
    console.error("Logo upload error:", uploadError);
    return NextResponse.redirect(new URL("/settings?error=upload", req.url));
  }

  const { data: publicUrlData } = db.storage.from("logos").getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await db.from("business_settings").upsert({
    id: 1,
    logo_url: logoUrl,
    updated_at: new Date().toISOString(),
  });

  if (updateError) {
    console.error("Save logo url error:", updateError);
    return NextResponse.redirect(new URL("/settings?error=save", req.url));
  }

  return NextResponse.redirect(new URL("/settings?saved=1", req.url));
}
