import { supabaseAdmin } from "./supabaseClient";

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
};

export async function getBusinessSettings() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return DEFAULTS;
  }

  return { ...DEFAULTS, ...data };
}
