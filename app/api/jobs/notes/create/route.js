import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canAccessJob } from "../../../../lib/jobAccess";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");
  const note = (form.get("note") || "").toString().trim();
  const important = form.get("important") === "1";
  const image = form.get("image");

  if (!jobId || !note) {
    return NextResponse.json({ error: "Missing job or note text" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const adminDb = supabaseAdmin();

  const { data: jobForCheck } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", jobId)
    .maybeSingle();
  const hasAccess = await canAccessJob(db, jobForCheck, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  let imageUrl = null;
  let imageStoragePath = null;

  if (image && typeof image !== "string" && image.size > 0) {
    const bytes = new Uint8Array(await image.arrayBuffer());
    const ext = (image.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${jobId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await adminDb.storage
      .from("job-note-images")
      .upload(path, bytes, { contentType: image.type || "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("Note image upload error:", uploadError);
      return NextResponse.json(
        { error: `Couldn't upload the image: ${uploadError.message}` },
        { status: 400 }
      );
    }

    // Private bucket - path only, signed on read.
    imageUrl = null;
    imageStoragePath = path;
  }

  const { error } = await db.from("job_notes").insert({
    job_id: jobId,
    note,
    important,
    image_url: imageUrl,
    image_storage_path: imageStoragePath,
    created_by: currentMember?.id || null,
    business_id: currentMember.business_id,
  });

  if (error) {
    console.error("Create job note error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
