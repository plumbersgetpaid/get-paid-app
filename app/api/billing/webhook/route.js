import { getStripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

// Stripe signs every webhook. Verifying that signature is what stops
// anyone who finds this URL posting a fake "payment succeeded" and
// unlocking the app for free, so a failed verification is rejected
// outright rather than logged and waved through.
//
// The raw body is required for verification - it has to be the exact
// bytes Stripe signed, which is why this reads req.text() and never
// req.json().
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function periodEndFrom(subscription) {
  // current_period_end sits on the subscription in older API versions
  // and on the individual item in newer ones. Checking both means this
  // keeps working across a Stripe API version bump rather than quietly
  // writing nulls.
  if (subscription?.current_period_end) {
    return new Date(subscription.current_period_end * 1000).toISOString();
  }
  const item = subscription?.items?.data?.[0];
  if (item?.current_period_end) {
    return new Date(item.current_period_end * 1000).toISOString();
  }
  return null;
}

async function syncSubscription(db, businessId, sub) {
  if (!businessId) {
    console.error("Stripe webhook: no business_id on subscription", sub?.id);
    return;
  }

  // Ignore events about a subscription this business isn't on.
  //
  // A failed or abandoned checkout can leave orphaned subscriptions on
  // the same Stripe customer. Without this check, an event about one of
  // those would overwrite the status of the subscription the business
  // is actually paying for. A null stored id is fine - that's the first
  // checkout completing.
  const { data: existing } = await db
    .from("subscriptions")
    .select("stripe_subscription_id, canceled_at, status")
    .eq("business_id", businessId)
    .maybeSingle();

  // Ignore an event about a DIFFERENT subscription only while the stored
  // one is still live. A failed/abandoned checkout can leave an orphaned
  // sub on the same customer, and an event about it must not overwrite the
  // one the business is actually paying for.
  //
  // But a cancelled subscription is not something to protect: when a
  // business resubscribes, Stripe issues a brand-new subscription id, so
  // "differs from the stored id" is exactly what a resubscribe looks like.
  // Blocking it here left the row stuck on 'canceled' forever - the
  // customer paid, stayed locked out, and the 30-day deletion cron then
  // wiped their data. So only guard when the stored subscription is still
  // in a status that grants access.
  const storedIsLive =
    existing?.status && existing.status !== "canceled" && existing.status !== "incomplete_expired";

  if (existing?.stripe_subscription_id && existing.stripe_subscription_id !== sub.id && storedIsLive) {
    console.log(
      "Stripe webhook: ignoring event for a different subscription",
      sub.id,
      "- business is live on",
      existing.stripe_subscription_id
    );
    return;
  }

  // Out-of-order protection: Stripe doesn't guarantee event order, and our
  // own 500-to-retry design increases reordering. A Stripe subscription
  // that has been DELETED is terminal - the same subscription id never
  // becomes active again (a real resubscribe always gets a NEW id, which
  // passes because the stored status isn't live). So a non-canceled status
  // arriving for the SAME id we've recorded as canceled can only be a
  // stale, delayed event - and applying it would resurrect a cancelled
  // account and wipe its 30-day deletion clock.
  if (
    existing?.status === "canceled" &&
    existing?.stripe_subscription_id === sub.id &&
    sub.status !== "canceled"
  ) {
    console.log(
      "Stripe webhook: ignoring stale out-of-order event for cancelled subscription",
      sub.id
    );
    return;
  }

  const seats = sub?.items?.data?.[0]?.quantity ?? null;

  const patch = {
    status: sub.status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    current_period_end: periodEndFrom(sub),
    updated_at: new Date().toISOString(),
  };
  if (seats) patch.seats = seats;

  // Once Stripe is managing the subscription, our own trial date stops
  // being the source of truth - clearing it avoids the app and Stripe
  // disagreeing about when the trial ended.
  if (sub.status !== "trialing") {
    patch.trial_ends_at = null;
  } else if (sub.trial_end) {
    patch.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
  }

  // A cancellation can also arrive as a status change on
  // subscription.updated rather than subscription.deleted. Stamp the
  // clock here too, once, and never overwrite an existing stamp.
  if (sub.status === "canceled" && !existing?.canceled_at) {
    patch.canceled_at = new Date().toISOString();
  }

  // Coming back from cancelled - a resubscribe - has to clear the clock,
  // or the account would be deleted 30 days after a cancellation it has
  // since reversed.
  if (sub.status !== "canceled" && existing?.canceled_at) {
    patch.canceled_at = null;
  }

  const { error } = await db.from("subscriptions").update(patch).eq("business_id", businessId);
  if (error) {
    // Throw so the POST handler returns 500 and Stripe RETRIES. Swallowing
    // this used to 200-ack a lost state change: a cancelled subscription
    // could stay status='active' (unpaid access forever), or a resubscribe
    // stay 'canceled' (account then deleted by the 30-day cron). The event
    // is the only signal we get, so a failed write must not be acknowledged.
    console.error("Stripe webhook: subscription update failed", businessId, error);
    throw new Error(`subscription update failed: ${error.message}`);
  }
}

async function businessIdFor(db, sub) {
  // Prefer the metadata we set at checkout; fall back to matching on
  // the customer id so a subscription created another way (a manual
  // one in the Stripe dashboard, say) still lands on the right row.
  const fromMeta = sub?.metadata?.business_id;
  if (fromMeta) return fromMeta;

  const customerId = typeof sub?.customer === "string" ? sub.customer : sub?.customer?.id;
  if (!customerId) return null;

  const { data } = await db
    .from("subscriptions")
    .select("business_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.business_id || null;
}

export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Stripe webhook: STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    // A failure here means the request didn't come from Stripe, or was
    // replayed outside the tolerance window. Either way it's rejected.
    console.error("Stripe webhook signature verification failed:", e.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = supabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const businessId = session.metadata?.business_id || session.client_reference_id;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscription(db, businessId, sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object;
        await syncSubscription(db, await businessIdFor(db, sub), sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        // Matched on the subscription id, not the business. Cancelling
        // an old abandoned subscription must not mark a business
        // cancelled when they're paying on a different one - that would
        // lock a paying customer out because of someone else's tidy-up.
        // canceled_at starts the 30-day retention clock and is only set
        // if it isn't already - re-running this must not push the
        // deletion date back. See supabase/delete-cancelled-business.sql.
        const { error: delErr } = await db
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id)
          .is("canceled_at", null);

        // Status still needs setting even where canceled_at was already
        // stamped by an earlier event.
        const { error: statusErr } = await db
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id)
          .not("canceled_at", "is", null);
        if (delErr || statusErr) {
          // Throw so Stripe retries — a cancelled subscription left marked
          // 'active' keeps letting an unpaid business in forever.
          console.error("Stripe webhook: cancel update failed", sub.id, delErr || statusErr);
          throw new Error(`cancel update failed: ${(delErr || statusErr).message}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        // Scoped to the subscription rather than the customer. One
        // customer can end up with several subscriptions, and a failed
        // payment on an abandoned one shouldn't put a live account into
        // past_due.
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subId) {
          const { error: pastDueErr } = await db
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subId);
          if (pastDueErr) {
            // Throw so Stripe retries — otherwise a failed payment never
            // marks the account past_due and dunning never starts.
            console.error("Stripe webhook: past_due update failed", subId, pastDueErr);
            throw new Error(`past_due update failed: ${pastDueErr.message}`);
          }
        } else {
          console.log("Stripe webhook: payment_failed with no subscription", invoice.id);
        }
        break;
      }

      default:
        // Everything else is ignored on purpose. Stripe sends a lot of
        // events and acknowledging them keeps it from retrying.
        break;
    }
  } catch (e) {
    // Returning 500 tells Stripe to retry, which is what we want for a
    // transient database problem - the event isn't lost.
    console.error("Stripe webhook handler error:", event.type, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
