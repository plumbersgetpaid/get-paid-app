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

  const { error } = await db.from("subscriptions").update(patch).eq("business_id", businessId);
  if (error) {
    console.error("Stripe webhook: subscription update failed", businessId, error);
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
        const businessId = await businessIdFor(db, sub);
        if (businessId) {
          await db
            .from("subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("business_id", businessId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await db
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_customer_id", customerId);
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
