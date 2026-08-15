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
  const keepId = form.get("keepId");
  const mergeId = form.get("mergeId");

  if (!keepId || !mergeId || keepId === mergeId) {
    return NextResponse.json({ error: "Missing or invalid customer IDs" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { data: keepCustomer, error: keepErr } = await db
    .from("customers")
    .select("*")
    .eq("id", keepId)
    .maybeSingle();
  const { data: mergeCustomer, error: mergeErr } = await db
    .from("customers")
    .select("*")
    .eq("id", mergeId)
    .maybeSingle();

  if (keepErr || mergeErr) {
    console.error("Merge customer lookup error:", keepErr || mergeErr);
    return NextResponse.json({ error: "Couldn't look up these customers" }, { status: 400 });
  }
  if (!keepCustomer || !mergeCustomer) {
    return NextResponse.json(
      { error: "One of these customers no longer exists - refresh the page and try again" },
      { status: 400 }
    );
  }

  const { error: reassignErr } = await db
    .from("jobs")
    .update({ customer_id: keepId })
    .eq("customer_id", mergeId);

  if (reassignErr) {
    console.error("Merge reassign error:", reassignErr);
    return NextResponse.json({ error: reassignErr.message }, { status: 400 });
  }

  const { error: recurringReassignErr } = await db
    .from("recurring_jobs")
    .update({ customer_id: keepId })
    .eq("customer_id", mergeId);

  if (recurringReassignErr) {
    console.error("Merge recurring job reassign error:", recurringReassignErr);
    return NextResponse.json({ error: recurringReassignErr.message }, { status: 400 });
  }

  const updates = {};
  if (!keepCustomer.phone && mergeCustomer.phone) updates.phone = mergeCustomer.phone;
  if (!keepCustomer.email && mergeCustomer.email) updates.email = mergeCustomer.email;
  if (!keepCustomer.address && mergeCustomer.address) updates.address = mergeCustomer.address;
  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await db.from("customers").update(updates).eq("id", keepId);
    if (updateErr) {
      console.error("Merge contact-fill error:", updateErr);
    }
  }

  const { data: deletedRows, error: deleteErr } = await db
    .from("customers")
    .delete()
    .eq("id", mergeId)
    .select("id");

  if (deleteErr) {
    console.error("Merge delete error:", deleteErr);
    return NextResponse.json({ error: deleteErr.message }, { status: 400 });
  }

  if (!deletedRows || deletedRows.length === 0) {
    console.error("Merge delete affected zero rows for mergeId:", mergeId);
    return NextResponse.json(
      {
        error:
          "The duplicate couldn't actually be removed, even though nothing errored - it may have already been merged. Refresh and check if it's still listed.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
