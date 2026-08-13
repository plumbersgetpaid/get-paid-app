import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canSeeEverything } from "../../../../lib/permissions";
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

  if (!canSeeEverything(currentMember)) {
    const { data: jobForCheck } = await db
      .from("jobs")
      .select("assigned_to")
      .eq("id", existingNote?.job_id)
      .maybeSingle();
    if (!jobForCheck || jobForCheck.assigned_to !== currentMember?.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
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
