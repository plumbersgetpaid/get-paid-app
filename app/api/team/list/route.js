import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function GET() {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const db = await getScopedDb(currentMember);
  const { data } = await db
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return NextResponse.json({ teamMembers: data || [] });
}
