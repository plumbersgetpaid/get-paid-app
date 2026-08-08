import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const invoiceId = form.get("invoiceId");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("job_id")
    .single();

  if (invErr) {
    console.error("Mark paid error:", invErr);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  // Keep the job status in sync with the invoice
  if (invoice?.job_id) {
    await db.from("jobs").update({ status: "paid" }).eq("id", invoice.job_id);
  }

  return NextResponse.redirect(new URL("/", req.url));
}
