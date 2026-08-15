import { getCurrentTeamMember } from "../../../../lib/auth";
import { canAccessJob } from "../../../../lib/jobAccess";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const db = await getScopedDb(currentMember);

  const { data: jobForCheck } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", jobId)
    .maybeSingle();
  const hasAccess = await canAccessJob(db, jobForCheck, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const { data: notes, error } = await db
    .from("job_notes")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("List job notes error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const creatorIds = [...new Set((notes || []).map((n) => n.created_by).filter(Boolean))];
  const { data: creators } = creatorIds.length
    ? await db.from("team_members").select("id, name").in("id", creatorIds)
    : { data: [] };
  const creatorNameById = Object.fromEntries((creators || []).map((c) => [c.id, c.name]));

  const notesWithCreator = (notes || []).map((n) => ({
    ...n,
    creator_name: creatorNameById[n.created_by] || null,
  }));

  return NextResponse.json({ notes: notesWithCreator });
}
