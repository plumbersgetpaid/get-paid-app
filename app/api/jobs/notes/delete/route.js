import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const noteId = form.get("noteId");
  const jobId = form.get("jobId");

  if (!noteId) {
    return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("job_notes").delete().eq("id", noteId);

  if (error) {
    console.error("Delete job note error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/jobs/notes/${jobId}`, req.url));
}
