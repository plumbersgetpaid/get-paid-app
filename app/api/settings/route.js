import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();

  const business_name = form.get("business_name") || "Your Plumber";
  // Never allow a blank contact email. It's the Reply-To on every
  // customer email, so an empty value would send replies to PatchUp's
  // shared address instead of the business. If cleared, fall back to the
  // owner/manager's own login email - always the business, never us.
  const contact_email = (form.get("contact_email") || "").trim() || currentMember.email;
  const contact_phone = form.get("contact_phone") || null;
  const accent_color = form.get("accent_color") || "#111111";
  const logo_url = form.get("logo_url") || null;
  const invoice_note = form.get("invoice_note") || null;
  const header_tagline = form.get("header_tagline") || null;
  const payment_terms = form.get("payment_terms") || null;
  const bank_details = form.get("bank_details") || null;
  const currency = form.get("currency") || "GBP";
  const google_review_link = form.get("google_review_link") || null;

  const db = await getScopedDb(currentMember);

  const { error } = await db.from("business_settings").upsert(
    {
      business_id: currentMember.business_id,
      business_name,
      contact_email,
      contact_phone,
      accent_color,
      logo_url,
      invoice_note,
      header_tagline,
      payment_terms,
      bank_details,
      currency,
      google_review_link,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (error) {
    console.error("Save settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
