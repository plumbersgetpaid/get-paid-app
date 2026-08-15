import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember || !canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { jobId, assignedTo } = body;

  if (!jobId) {
    return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  if (assignedTo) {
    const { data: member } = await db
      .from("team_members")
      .select("id")
      .eq("id", assignedTo)
      .eq("is_active", true)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "That team member no longer exists" }, { status: 400 });
    }
  }

  const { error } = await db
    .from("jobs")
    .update({ assigned_to: assignedTo || null })
    .eq("id", jobId);

  if (error) {
    console.error("Job assignment error:", error);
    return NextResponse.json({ error: "Couldn't update assignment" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
