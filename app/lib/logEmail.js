import { supabaseAdmin } from "./supabaseClient";
// Records that a customer-facing email went out, so the tradesperson can see
// "what has actually been sent" on the job page - they have no Sent folder,
// because the app sends from notifications@getpatchup.co.uk on their behalf.
//
// Best-effort by design: the email is already gone by the time this runs, so
// a logging failure must never break the send path - but it IS logged loudly,
// because a missing row here means the UI under-reports what the customer
// received (same reasoning as chase_log).
//
// Invoice CHASES are not logged here - chase_log is already their record;
// the job page merges both tables into one list.
// Uses the admin client (email_log is RLS-locked with no policies - the
// service-role-only posture, same as processed_requests), so business_id
// MUST be set explicitly by every caller - the standing service-role rule.
export async function logEmailSent({ businessId, jobId, customerId, to, kind, subject }) {
  try {
    const db = supabaseAdmin();
    const { error } = await db.from("email_log").insert({
      business_id: businessId,
      job_id: jobId || null,
      customer_id: customerId || null,
      email_to: to || null,
      kind,
      subject: subject || null,
    });
    if (error) {
      console.error("email_log insert failed (email WAS sent):", kind, jobId, error.message);
    }
  } catch (e) {
    console.error("email_log insert crashed (email WAS sent):", kind, jobId, e?.message);
  }
}

// Display labels for the job page - one place, so wording stays consistent.
export const EMAIL_KIND_LABELS = {
  quote: "Quote",
  quote_chase: "Quote follow-up",
  booking_confirmation: "Booking confirmation",
  invoice: "Invoice",
  review_request: "Review request",
  deposit_request: "Deposit request",
  deposit_chase: "Deposit reminder",
};
