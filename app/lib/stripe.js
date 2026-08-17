import Stripe from "stripe";

// One shared client. Constructed lazily so that importing this module
// doesn't throw during a build where the key isn't present - Vercel
// builds run without runtime env vars in some configurations, and a
// module-level throw would fail the whole build rather than the one
// request that actually needs Stripe.
let cached = null;

export function getStripe() {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cached = new Stripe(key);
  return cached;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

// What each Stripe status means for whether someone can use the app.
//
// past_due is deliberately still allowed: the card failed but Stripe
// is retrying, and locking someone out of their invoicing the same day
// their bank declined a payment is a good way to lose a customer over
// something that usually resolves itself.
const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

export function hasAccess(subscription) {
  if (!subscription) return false;

  if (subscription.status === "trialing") {
    // Trust our own trial_ends_at rather than the status alone, so a
    // row that never got updated can't grant an unlimited free ride.
    if (!subscription.trial_ends_at) return true;
    return new Date(subscription.trial_ends_at) > new Date();
  }

  return ACTIVE_STATUSES.has(subscription.status);
}

export function trialDaysLeft(subscription) {
  if (!subscription?.trial_ends_at) return null;
  if (subscription.status !== "trialing") return null;
  const ms = new Date(subscription.trial_ends_at) - new Date();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// £19 for the first person, £8 for everyone after - mirrors the
// graduated tiers set up on the Stripe price, so the figure shown in
// the app and the figure Stripe actually charges come from the same
// rule.
export function monthlyTotal(seats) {
  const n = Math.max(1, Number(seats) || 1);
  return 19 + (n - 1) * 8;
}
