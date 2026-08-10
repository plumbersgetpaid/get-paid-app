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
  const { data: keepCustomer } = await db
    .from("customers")
    .select("*")
    .eq("id", keepId)
    .single();
  const { data: mergeCustomer } = await db
    .from("customers")
    .select("*")
    .eq("id", mergeId)
    .single();

  if (keepCustomer && mergeCustomer) {
    const updates = {};
    if (!keepCustomer.phone && mergeCustomer.phone) updates.phone = mergeCustomer.phone;
    if (!keepCustomer.email && mergeCustomer.email) updates.email = mergeCustomer.email;
    if (!keepCustomer.address && mergeCustomer.address) updates.address = mergeCustomer.address;
    if (Object.keys(updates).length > 0) {
      await db.from("customers").update(updates).eq("id", keepId);
    }
  }

  // Now safe to remove the duplicate - nothing references it any more
  const { error: deleteErr } = await db.from("customers").delete().eq("id", mergeId);

  if (deleteErr) {
    console.error("Merge delete error:", deleteErr);
    return NextResponse.json({ error: deleteErr.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/clients/${keepId}`, req.url));
}
