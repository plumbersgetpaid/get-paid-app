import { getCurrentTeamMember } from "../../../lib/auth";
import { getSubscription } from "../../../lib/getSubscription";
import { hasAccess } from "../../../lib/stripe";
import { NextResponse } from "next/server";

// Small endpoint the billing page polls after checkout, so it can tell
// when Stripe's webhook has landed and update itself rather than
// leaving someone refreshing manually.
export const dynamic = "force-dynamic";

export async function GET() {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ active: false }, { status: 401 });
  }

  const subscription = await getSubscription(currentMember.business_id);

  return NextResponse.json({
    active: Boolean(subscription?.stripe_subscription_id) && hasAccess(subscription),
    status: subscription?.status || null,
  });
}
