import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canCreateRecurringJob } from "../../../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canCreateRecurringJob(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const recurringId = form.get("recurringId");

  if (!recurringId) {
    return NextResponse.json({ error: "Missing recurringId" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("recurring_jobs").delete().eq("id", recurringId);

  if (error) {
    console.error("Delete recurring job error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/jobs/recurring", req.url));
}
