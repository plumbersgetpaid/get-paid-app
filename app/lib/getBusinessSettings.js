import { supabaseAdmin } from "./supabaseClient";
import { getCurrentTeamMember } from "./auth";

const DEFAULTS = {
  business_name: "Your Plumber",
  contact_email: null,
  contact_phone: null,
  accent_color: "#111111",
  logo_url: null,
  invoice_note: null,
  header_tagline: null,
  payment_terms: null,
  bank_details: null,
  currency: "GBP",
  include_weekends: true,
  google_review_link: null,
  send_review_requests: true,
};

export async function getBusinessSettings(businessId) {
  let resolvedBusinessId = businessId;
  if (!resolvedBusinessId) {
    const currentMember = await getCurrentTeamMember();
    resolvedBusinessId = currentMember?.business_id;
  }

  if (!resolvedBusinessId) {
    return DEFAULTS;
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("business_settings")
    .select("*")
    .eq("business_id", resolvedBusinessId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULTS;
  }

  return { ...DEFAULTS, ...data };
}
