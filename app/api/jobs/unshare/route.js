import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");
  const teamMemberId = form.get("teamMemberId");

  if (!jobId || !teamMemberId) {
    return NextResponse.json({ error: "Missing job or team member" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { data: job } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.assigned_to === teamMemberId) {
    await db.from("jobs").update({ assigned_to: null }).eq("id", jobId);
  }

  const { error } = await db
    .from("job_shares")
    .delete()
    .eq("job_id", jobId)
    .eq("team_member_id", teamMemberId);

  if (error) {
    console.error("Unshare job error:", error);
    return NextResponse.json({ error: "Couldn't remove that share" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
