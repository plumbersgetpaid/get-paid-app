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
    // The return_url points at a page whose only job is window.close().
    //
    // History of this decision: originally there was no return_url at
    // all, so Stripe showed no "return" button and the way back was
    // closing the tab by hand. On mobile nobody closes tabs - they tap
    // back, walk into expired Stripe pages, and loop. A return link
    // that navigated to the app recreated the same mess one layer down.
    // The missing piece: this tab was opened by window.open(), and a
    // script-opened tab may close itself. So the return button now
    // lands on /billing/portal-return, the tab closes, and the person
    // is back in the original tab with no Stripe history anywhere.
    const origin = new URL(req.url).origin;
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/billing/portal-return`,
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
