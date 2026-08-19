import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canAccessJob } from "../../../../lib/jobAccess";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";
import { claimRequest, releaseRequest } from "../../../../lib/idempotency";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");
  const label = form.get("label") === "after" ? "after" : "before";
  const photo = form.get("photo");

  if (!jobId || !photo || typeof photo === "string" || photo.size === 0) {
    return NextResponse.json({ error: "Missing job or photo" }, { status: 400 });
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

  // Retry protection: a resend of this exact action - flaky signal,
  // double-tap, browser resubmit, offline replay - is answered with the
  // success response instead of running twice. See lib/idempotency.js.
  const claim = await claimRequest(form.get("request_id"), currentMember.business_id, "photos/upload");
  if (claim.duplicate) {
    return NextResponse.redirect(new URL(`/jobs/photos/${jobId}`, req.url), 303);
  }


  const bytes = new Uint8Array(await photo.arrayBuffer());
  const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${jobId}/${label}-${Date.now()}.${ext}`;

  const { error: uploadError } = await adminDb.storage
    .from("job-photos")
    .upload(path, bytes, { contentType: photo.type || "image/jpeg", upsert: true });

  if (uploadError) {
    console.error("Job photo upload error:", uploadError);
    const redirectUrl = new URL(`/jobs/photos/${jobId}`, req.url);
    redirectUrl.searchParams.set("error", uploadError.message || "Upload failed");
    await releaseRequest(claim);
    return NextResponse.redirect(redirectUrl, 303);
  }

  // No public URL stored: the bucket is private, and a saved link would
  // either be dead or - worse - outlive the reason for having it. The
  // storage path is the record; links are signed on read.
  const { error: insertError } = await db.from("job_photos").insert({
    job_id: jobId,
    url: null,
    storage_path: path,
    label,
    business_id: currentMember.business_id,
  });

  if (insertError) {
    console.error("Job photo record error:", insertError);
    await releaseRequest(claim);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/jobs/photos/${jobId}`, req.url), 303);
}
