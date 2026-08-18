import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getSubscription, countActiveSeats } from "../../../lib/getSubscription";
import { getStripe, stripeConfigured } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();

  // Only an owner or manager can commit the business to a bill.
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't set up yet - get in touch and we'll sort it." },
      { status: 500 }
    );
  }

  const businessId = currentMember.business_id;
  const stripe = getStripe();
  const db = supabaseAdmin();

  const subscription = await getSubscription(businessId);
  const seats = await countActiveSeats(businessId);

  // Reuse the Stripe customer if this business has one, so a second
  // attempt doesn't create a duplicate.
  //
  // The write-back below is checked rather than fire-and-forget. If the
  // subscriptions row doesn't exist, the update silently affects zero
  // rows, the id is never saved, and the next attempt creates another
  // customer - which is how one account ended up with five. Creating
  // the row when it's missing stops that at the source.
  let customerId = subscription?.stripe_customer_id || null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: currentMember.email,
      name: currentMember.name,
      metadata: { business_id: businessId },
    });
    customerId = customer.id;

    if (subscription) {
      const { error: updErr } = await db
        .from("subscriptions")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("business_id", businessId);
      if (updErr) {
        console.error("Checkout: couldn't save customer id", businessId, updErr);
        return NextResponse.json(
          { error: "Couldn't start checkout - try again in a moment." },
          { status: 500 }
        );
      }
    } else {
      // No row yet - businesses created before billing existed won't
      // have one, and without it nothing can be saved against them.
      const { error: insErr } = await db.from("subscriptions").insert({
        business_id: businessId,
        status: "trialing",
        seats,
        stripe_customer_id: customerId,
      });
      if (insErr) {
        console.error("Checkout: couldn't create subscription row", businessId, insErr);
        return NextResponse.json(
          { error: "Couldn't start checkout - try again in a moment." },
          { status: 500 }
        );
      }
    }
  }

  // If they still have trial left, hand the remaining days to Stripe
  // rather than granting a fresh 14 - otherwise subscribing early
  // quietly doubles the free period.
  let trialEnd;
  if (subscription?.trial_ends_at) {
    const endsAt = Math.floor(new Date(subscription.trial_ends_at).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    // Stripe requires a trial end at least 48 hours out; anything
    // shorter is cleaner to just skip.
    if (endsAt > now + 60 * 60 * 48) {
      trialEnd = endsAt;
    }
  }

  const origin = new URL(req.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: seats }],
      subscription_data: {
        ...(trialEnd ? { trial_end: trialEnd } : {}),
        metadata: { business_id: businessId },
      },
      // Also on the session itself: the subscription metadata isn't
      // present on checkout.session.completed, and the webhook needs
      // to know which business this belongs to.
      metadata: { business_id: businessId },
      client_reference_id: businessId,
      allow_promotion_codes: true,
      success_url: `${origin}/billing?done=1`,
      cancel_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe checkout error:", e);
    return NextResponse.json(
      { error: "Couldn't start checkout - try again in a moment." },
      { status: 500 }
    );
  }
}
