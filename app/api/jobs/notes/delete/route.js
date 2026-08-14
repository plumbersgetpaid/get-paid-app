import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canAccessJob } from "../../../../lib/jobAccess";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  const form = await req.formData();
  const noteId = form.get("noteId");

  if (!noteId) {
    return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: existingNote } = await db
    .from("job_notes")
    .select("image_storage_path, job_id")
    .eq("id", noteId)
    .single();

  const { data: jobForCheck } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", existingNote?.job_id)
    .maybeSingle();
  const hasAccess = await canAccessJob(db, jobForCheck, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (existingNote?.image_storage_path) {
    await db.storage.from("job-note-images").remove([existingNote.image_storage_path]);
  }

  const { error } = await db.from("job_notes").delete().eq("id", noteId);

  if (error) {
    console.error("Delete job note error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
