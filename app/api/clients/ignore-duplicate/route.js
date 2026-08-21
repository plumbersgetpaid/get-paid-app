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
  if (customerId === dupeId) {
    return NextResponse.json({ error: "Can't ignore a customer against itself" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  // Both IDs must be real customers of THIS business before we record them as a
  // "not a duplicate" pair. `db` is business-scoped, so a customer from another
  // business (or a since-deleted one) won't come back here - which stops a
  // tampered request from writing an ignored_duplicates row that points at
  // customers outside this business. Two IDs found = both belong here.
  const { data: found } = await db
    .from("customers")
    .select("id")
    .in("id", [customerId, dupeId]);
  const foundIds = new Set((found || []).map((c) => c.id));
  if (!foundIds.has(customerId) || !foundIds.has(dupeId)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  }

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
