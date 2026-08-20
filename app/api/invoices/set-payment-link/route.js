import { getCurrentTeamMember } from "../../../lib/auth";
import { canInvoice } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { sanitizePaymentLink } from "../../../lib/paymentLink";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const invoiceId = form.get("invoiceId");
  const rawLink = (form.get("paymentLink") || "").toString().trim();
  // Emailed to homeowners as "Pay now" - must be a real http(s) URL.
  const paymentLink = sanitizePaymentLink(rawLink);

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }
  if (rawLink && !paymentLink) {
    return NextResponse.json(
      { error: "That doesn't look like a valid link - it needs to start with https://" },
      { status: 400 }
    );
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

  return NextResponse.redirect(new URL(`/invoices/${invoiceId}`, req.url), 303);
}
