import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: existingInvoice } = await db
    .from("invoices")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();
  if (existingInvoice) {
    return NextResponse.json(
      { error: "This job has an invoice attached and can't be deleted - cancel it instead" },
      { status: 400 }
    );
  }

  const { data: notesWithImages } = await db
    .from("job_notes")
    .select("image_storage_path")
    .eq("job_id", jobId)
    .not("image_storage_path", "is", null);
  const notePaths = (notesWithImages || []).map((n) => n.image_storage_path).filter(Boolean);
  if (notePaths.length > 0) {
    await db.storage.from("job-note-images").remove(notePaths);
  }

  const { data: photos } = await db
    .from("job_photos")
    .select("storage_path")
    .eq("job_id", jobId);
  const photoPaths = (photos || []).map((p) => p.storage_path).filter(Boolean);
  if (photoPaths.length > 0) {
    await db.storage.from("job-photos").remove(photoPaths);
  }

  await db.from("job_notes").delete().eq("job_id", jobId);
  await db.from("job_photos").delete().eq("job_id", jobId);
  await db.from("job_shares").delete().eq("job_id", jobId);

  const { error } = await db.from("jobs").delete().eq("id", jobId);

  if (error) {
    console.error("Delete job error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/work?tab=jobs", req.url));
}
