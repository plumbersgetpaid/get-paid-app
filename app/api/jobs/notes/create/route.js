import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const note = (form.get("note") || "").toString().trim();
  const important = form.get("important") === "1";
  const image = form.get("image");

  if (!jobId || !note) {
    return NextResponse.json({ error: "Missing job or note text" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Images for notes live in a completely separate storage bucket from
  // job photos - keeps this structurally impossible to ever end up in an
  // invoice email, not just hidden by convention
  let imageUrl = null;
  let imageStoragePath = null;

  if (image && typeof image !== "string" && image.size > 0) {
    const bytes = new Uint8Array(await image.arrayBuffer());
    const ext = (image.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${jobId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await db.storage
      .from("job-note-images")
      .upload(path, bytes, { contentType: image.type || "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("Note image upload error:", uploadError);
      return NextResponse.json(
        { error: `Couldn't upload the image: ${uploadError.message}` },
        { status: 400 }
      );
    }

    const { data: publicUrlData } = db.storage.from("job-note-images").getPublicUrl(path);
    imageUrl = publicUrlData.publicUrl;
    imageStoragePath = path;
  }

  const { error } = await db.from("job_notes").insert({
    job_id: jobId,
    note,
    important,
    image_url: imageUrl,
    image_storage_path: imageStoragePath,
  });

  if (error) {
    console.error("Create job note error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
