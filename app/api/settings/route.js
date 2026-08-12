import { supabaseAdmin } from "../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything } from "../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();

  const business_name = form.get("business_name") || "Your Plumber";
  const contact_email = form.get("contact_email") || null;
  const contact_phone = form.get("contact_phone") || null;
  const accent_color = form.get("accent_color") || "#111111";
  const logo_url = form.get("logo_url") || null;
  const invoice_note = form.get("invoice_note") || null;
  const header_tagline = form.get("header_tagline") || null;
  const payment_terms = form.get("payment_terms") || null;
  const bank_details = form.get("bank_details") || null;
  const currency = form.get("currency") || "GBP";
  const google_review_link = form.get("google_review_link") || null;

  const db = supabaseAdmin();

  const { error } = await db.from("business_settings").upsert({
    id: 1,
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
  });

  if (error) {
    console.error("Save settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
