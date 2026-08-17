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

  try {
    // No return_url on purpose.
    //
    // Stripe only renders its "return to..." link when a return URL is
    // set, so omitting it removes the button entirely. That's what we
    // want here: the portal opens in its own tab, so the way back is
    // to close it. Offering a link that navigates the tab to the app
    // instead just recreates the back-button mess in the new tab.
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
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
