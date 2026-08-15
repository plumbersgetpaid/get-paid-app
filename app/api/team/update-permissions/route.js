import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

const PERMISSION_FIELDS = [
  "can_invoice",
  "can_see_client_database",
  "can_create_quote",
  "can_create_job",
  "can_create_recurring_job",
  "can_reschedule",
];

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const memberId = form.get("memberId");

  if (!memberId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { data: target } = await db
    .from("team_members")
    .select("role")
    .eq("id", memberId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "That account no longer exists" }, { status: 404 });
  }

  if (target.role !== "subcontractor") {
    return NextResponse.json(
      { error: "Granular permissions only apply to subcontractors" },
      { status: 400 }
    );
  }

  const updates = {};
  for (const field of PERMISSION_FIELDS) {
    updates[field] = form.get(field) === "1";
  }

  const { error } = await db
    .from("team_members")
    .update(updates)
    .eq("id", memberId);

  if (error) {
    console.error("Update permissions error:", error);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
