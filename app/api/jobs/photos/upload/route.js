import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const label = form.get("label") === "after" ? "after" : "before";
  const photo = form.get("photo");

  if (!jobId || !photo || typeof photo === "string" || photo.size === 0) {
    return NextResponse.json({ error: "Missing job or photo" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${jobId}/${label}-${Date.now()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from("job-photos")
    .upload(path, bytes, { contentType: photo.type || "image/jpeg", upsert: true });

  if (uploadError) {
    console.error("Job photo upload error:", uploadError);
    const redirectUrl = new URL(`/jobs/photos/${jobId}`, req.url);
    redirectUrl.searchParams.set("error", uploadError.message || "Upload failed");
    return NextResponse.redirect(redirectUrl);
  }

  const { data: publicUrlData } = db.storage.from("job-photos").getPublicUrl(path);

  const { error: insertError } = await db.from("job_photos").insert({
    job_id: jobId,
    url: publicUrlData.publicUrl,
    storage_path: path,
    label,
  });

  if (insertError) {
    console.error("Job photo record error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/jobs/photos/${jobId}`, req.url));
}
