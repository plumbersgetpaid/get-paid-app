import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canAccessJob } from "../../../lib/jobAccess";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");
  const teamMemberId = form.get("teamMemberId");

  if (!jobId || !teamMemberId) {
    return NextResponse.json({ error: "Missing job or team member" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: job } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { data: targetMember } = await db
    .from("team_members")
    .select("id")
    .eq("id", teamMemberId)
    .eq("is_active", true)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: "That team member no longer exists" }, { status: 400 });
  }

  const { error } = await db
    .from("job_shares")
    .insert({ job_id: jobId, team_member_id: teamMemberId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    console.error("Share job error:", error);
    return NextResponse.json({ error: "Couldn't share this job" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
