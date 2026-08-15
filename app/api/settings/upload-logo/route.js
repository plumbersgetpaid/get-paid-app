import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("logo");

  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json({ error: "No logo file received" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const adminDb = supabaseAdmin();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await adminDb.storage
    .from("logos")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: true });

  if (uploadError) {
    console.error("Logo upload error:", uploadError);
    return NextResponse.json({ error: `Couldn't upload the logo: ${uploadError.message}` }, { status: 400 });
  }

  const { data: publicUrlData } = adminDb.storage.from("logos").getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await db.from("business_settings").upsert(
    {
      business_id: currentMember.business_id,
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (updateError) {
    console.error("Save logo url error:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, logoUrl });
}
