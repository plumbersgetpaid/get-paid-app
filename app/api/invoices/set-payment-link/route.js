import { getCurrentTeamMember } from "../../../lib/auth";
import { canInvoice } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const invoiceId = form.get("invoiceId");
  const paymentLink = (form.get("paymentLink") || "").toString().trim();

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const { error } = await db
    .from("invoices")
    .update({ payment_link: paymentLink || null })
    .eq("id", invoiceId);

  if (error) {
    console.error("Set payment link error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/invoices/${invoiceId}`, req.url));
}
