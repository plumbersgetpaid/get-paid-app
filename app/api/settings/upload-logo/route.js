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
  // Store under a business_id folder, not a flat `logo-<timestamp>` name.
  // The flat name was unreachable by the 30-day deletion job (it couldn't
  // tell which file belonged to a cancelled business), so logos outlived
  // the account forever at a public URL. A per-business prefix lets the
  // cron list and remove them like it does job photos.
  const businessId = currentMember.business_id;
  const path = `${businessId}/logo-${Date.now()}.${ext}`;

  // Clear any previous logo in this business's folder first. Timestamped
  // names never collide, so without this every re-upload orphaned the old
  // file at a live public URL.
  const { data: existingFiles } = await adminDb.storage.from("logos").list(businessId);
  if (existingFiles?.length) {
    await adminDb.storage
      .from("logos")
      .remove(existingFiles.map((f) => `${businessId}/${f.name}`));
  }

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
