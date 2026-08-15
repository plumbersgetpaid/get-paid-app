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
  const customerId = form.get("customerId");
  const dupeId = form.get("dupeId");

  if (!customerId || !dupeId) {
    return NextResponse.json({ error: "Missing customer IDs" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const { error } = await db.from("ignored_duplicates").insert({
    customer_id_a: customerId,
    customer_id_b: dupeId,
    business_id: currentMember.business_id,
  });

  if (error) {
    console.error("Ignore duplicate error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
