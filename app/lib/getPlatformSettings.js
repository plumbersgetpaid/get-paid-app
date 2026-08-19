import { cache } from "react";
import { supabaseAdmin } from "./supabaseClient";

const DEFAULTS = {
  id: 1,
  app_logo_url: null,
  sign_off_logo_url: null,
  favicon_url: null,
};

// Platform-wide, not per-business - there's exactly one row, id=1,
// covering branding shared across every business on the platform (the
// login/setup screens). Deliberately separate from getBusinessSettings(),
// which is scoped per-business and answers a completely different
// question ("what does this one business look like on its invoices"),
// not "what does the platform itself look like before anyone's even
// logged in to a business yet".
export const getPlatformSettings = cache(async function getPlatformSettings() {
  const db = supabaseAdmin();
  const { data } = await db.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULTS, ...data };
})
