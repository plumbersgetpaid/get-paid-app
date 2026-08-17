import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getSubscription } from "../../../lib/getSubscription";
import { getStripe, stripeConfigured } from "../../../lib/stripe";
import { NextResponse } from "next/server";

// Sends the owner to Stripe's own billing portal, where they can
// update their card, see invoices, or cancel - all without you
// handling any of it by hand, and without card details ever touching
// this app.
export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Billing isn't set up yet" }, { status: 500 });
  }

  const subscription = await getSubscription(currentMember.business_id);
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet - start a subscription first." },
      { status: 400 }
    );
  }

  const origin = new URL(req.url).origin;

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe portal error:", e);
    return NextResponse.json(
      { error: "Couldn't open the billing portal - try again in a moment." },
      { status: 500 }
    );
  }
}
