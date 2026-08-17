import { supabaseAdmin } from "./supabaseClient";
import { getCurrentTeamMember } from "./auth";

// Reads the subscription row for a business. Stays on the service-role
// client deliberately: billing state has to be readable regardless of
// what RLS says, including at the moment access is being revoked.
export async function getSubscription(businessId) {
  let resolvedBusinessId = businessId;
  if (!resolvedBusinessId) {
    const currentMember = await getCurrentTeamMember();
    resolvedBusinessId = currentMember?.business_id;
  }
  if (!resolvedBusinessId) return null;

  const db = supabaseAdmin();
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .eq("business_id", resolvedBusinessId)
    .maybeSingle();

  return data || null;
}

// How many people are actually on the team right now. Used to keep the
// Stripe quantity honest - someone can add staff in the app without
// touching billing, and the seat count should follow the team rather
// than whatever number they typed at signup months ago.
export async function countActiveSeats(businessId) {
  const db = supabaseAdmin();
  const { count } = await db
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_active", true);
  return Math.max(1, count || 1);
}
