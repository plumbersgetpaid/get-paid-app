import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { isPlatformAdmin } from "../../../lib/permissions";
import { NextResponse } from "next/server";

// Same shape as upload-app-logo, with one difference that matters: a
// favicon is rendered at 16-32px in a browser tab, so the file is stored
// as uploaded rather than being treated as a display image. The emblem
// on its own reads at that size; the full lockup with wordmark does not.
export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!isPlatformAdmin(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("logo");

  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json({ error: "No favicon file received" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `favicon-${Date.now()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from("logos")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: true });

  if (uploadError) {
    console.error("Favicon upload error:", uploadError);
    return NextResponse.json(
      { error: `Couldn't upload the favicon: ${uploadError.message}` },
      { status: 400 }
    );
  }

  const { data: publicUrlData } = db.storage.from("logos").getPublicUrl(path);
  const faviconUrl = publicUrlData.publicUrl;

  const { error: updateError } = await db.from("platform_settings").upsert(
    {
      id: 1,
      favicon_url: faviconUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (updateError) {
    console.error("Save favicon url error:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, faviconUrl });
}
