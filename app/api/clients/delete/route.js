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

  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { count: jobCount } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if (jobCount && jobCount > 0) {
    return NextResponse.json(
      { error: "This client has jobs attached and can't be deleted" },
      { status: 400 }
    );
  }

  await db
    .from("ignored_duplicates")
    .delete()
    .or(`customer_id_a.eq.${customerId},customer_id_b.eq.${customerId}`);

  const { error } = await db.from("customers").delete().eq("id", customerId);

  if (error) {
    console.error("Delete client error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/clients", req.url));
}
