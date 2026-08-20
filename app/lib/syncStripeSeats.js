import { getStripe, stripeConfigured } from "./stripe";
import { getSubscription, countActiveSeats } from "./getSubscription";

// Keeps the Stripe quantity honest when the team changes size. The
// billing page promises "the count follows whoever's active in Team
// settings" - before this existed that was only true at the moment of
// checkout: add five staff afterwards and Stripe kept charging for one.
//
// Called after any team add/remove/activate/deactivate. Proration is
// Stripe's default (create_prorations), so a mid-cycle addition shows as
// a fair partial charge on the next invoice rather than a surprise full
// month.
//
// Deliberately never blocks the team change itself: running the business
// comes first, and the webhook re-syncs our seats column from whatever
// Stripe confirms. A failure here is loud in the logs - it's money.
export async function syncStripeSeats(businessId) {
  try {
    if (!stripeConfigured()) return;
    const sub = await getSubscription(businessId);
    if (!sub?.stripe_subscription_id) return; // still trialling pre-checkout
    if (!["active", "trialing", "past_due"].includes(sub.status)) return;

    const seats = await countActiveSeats(businessId);
    const stripe = getStripe();
    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = current?.items?.data?.[0];
    if (!item) return;
    if (item.quantity === seats) return;

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: item.id, quantity: seats }],
    });
    console.log(`Stripe seats synced for ${businessId}: ${item.quantity} -> ${seats}`);
  } catch (e) {
    console.error(`Stripe seat sync FAILED for ${businessId} - billing may undercharge:`, e.message);
  }
}
