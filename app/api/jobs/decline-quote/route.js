import { getCurrentTeamMember } from "../../../lib/auth";
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

  const { error } = await db
    .from("jobs")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error("Decline quote error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/", req.url));
}
