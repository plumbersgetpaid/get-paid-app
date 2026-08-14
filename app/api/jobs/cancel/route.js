import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");
  const from = (form.get("from") || "").toString();

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { error } = await db
    .from("jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId);

  if (error) {
    console.error("Cancel job error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const returnPath = from === "work" ? "/work?tab=jobs" : "/";
  return NextResponse.redirect(new URL(returnPath, req.url));
}
