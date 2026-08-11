import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const keepId = form.get("keepId");
  const mergeId = form.get("mergeId");

  if (!keepId || !mergeId || keepId === mergeId) {
    return NextResponse.json({ error: "Missing or invalid customer IDs" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Verify both customers genuinely exist before touching anything - if
  // either ID is stale (e.g. from clicking a button twice, or a merge
  // that already happened), fail clearly here rather than silently doing
  // nothing later
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

  // Move every job (and therefore its invoices, photos, etc, which all key
  // off job_id) from the duplicate onto the kept customer
  const { error: reassignErr } = await db
    .from("jobs")
    .update({ customer_id: keepId })
    .eq("customer_id", mergeId);

  if (reassignErr) {
    console.error("Merge reassign error:", reassignErr);
    return NextResponse.json({ error: reassignErr.message }, { status: 400 });
  }

  // Also move any recurring job templates - these reference a customer too
  const { error: recurringReassignErr } = await db
    .from("recurring_jobs")
    .update({ customer_id: keepId })
    .eq("customer_id", mergeId);

  if (recurringReassignErr) {
    console.error("Merge recurring job reassign error:", recurringReassignErr);
    return NextResponse.json({ error: recurringReassignErr.message }, { status: 400 });
  }

  // Fill in any missing contact details on the kept record from the
  // duplicate, without overwriting anything already there
  const updates = {};
  if (!keepCustomer.phone && mergeCustomer.phone) updates.phone = mergeCustomer.phone;
  if (!keepCustomer.email && mergeCustomer.email) updates.email = mergeCustomer.email;
  if (!keepCustomer.address && mergeCustomer.address) updates.address = mergeCustomer.address;
  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await db.from("customers").update(updates).eq("id", keepId);
    if (updateErr) {
      // Not fatal to the merge itself - log it and carry on
      console.error("Merge contact-fill error:", updateErr);
    }
  }

  // Now safe to remove the duplicate - explicitly check that a row was
  // actually deleted, not just that the request didn't error. A delete
  // that matches zero rows in Postgres "succeeds" with no error at all,
  // which would otherwise let this silently do nothing and still report
  // success back to the client.
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
