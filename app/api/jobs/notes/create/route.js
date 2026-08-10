import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const note = (form.get("note") || "").toString().trim();
  const important = form.get("important") === "1";

  if (!jobId || !note) {
    return NextResponse.json({ error: "Missing job or note text" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("job_notes").insert({ job_id: jobId, note, important });

  if (error) {
    console.error("Create job note error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/jobs/notes/${jobId}`, req.url));
}
