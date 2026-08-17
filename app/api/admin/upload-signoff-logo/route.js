import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { isPlatformAdmin } from "../../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!isPlatformAdmin(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("logo");

  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json({ error: "No logo file received" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `sign-off-logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from("logos")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: true });

  if (uploadError) {
    console.error("Sign-off logo upload error:", uploadError);
    return NextResponse.json({ error: `Couldn't upload the logo: ${uploadError.message}` }, { status: 400 });
  }

  const { data: publicUrlData } = db.storage.from("logos").getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await db.from("platform_settings").upsert(
    {
      id: 1,
      sign_off_logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (updateError) {
    console.error("Save sign-off logo url error:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, logoUrl });
}
