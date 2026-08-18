import { getCurrentTeamMember } from "../../../lib/auth";
import { canAccessJob } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  // Gate on access to THIS job, like complete and schedule do. Without it
  // any logged-in member - including a subcontractor with no permissions
  // and no assignment - could accept or decline any quote in the business;
  // a wrongful decline reads to the owner as the customer walking away.
  const { data: jobForCheck } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", jobId)
    .maybeSingle();
  const hasAccess = await canAccessJob(db, jobForCheck, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { error } = await db
    .from("jobs")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error("Decline quote error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/", req.url), 303);
}
