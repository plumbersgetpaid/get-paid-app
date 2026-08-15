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
  const photoId = form.get("photoId");
  const jobId = form.get("jobId");

  if (!photoId) {
    return NextResponse.json({ error: "Missing photoId" }, { status: 400 });
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

  const { data: photo } = await db
    .from("job_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();

  if (photo?.storage_path) {
    await adminDb.storage.from("job-photos").remove([photo.storage_path]);
  }

  const { error } = await db.from("job_photos").delete().eq("id", photoId);

  if (error) {
    console.error("Delete job photo error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/jobs/photos/${jobId}`, req.url));
}
