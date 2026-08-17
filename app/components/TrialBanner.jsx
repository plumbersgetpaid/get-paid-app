import Link from "next/link";
import { getSubscription } from "../lib/getSubscription";
import { trialDaysLeft } from "../lib/stripe";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything } from "../lib/permissions";
import { mono } from "../lib/theme";

// A quiet countdown on the Today page while a trial is running.
//
// Deliberately silent until the last week: a banner shown from day one
// is noise the whole way through, and nobody reads it by the time it
// matters. It also only appears for owners and managers - a
// subcontractor can't do anything about billing, so telling them is
// just clutter.
export default async function TrialBanner() {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) return null;

  const subscription = await getSubscription(currentMember.business_id);
  const daysLeft = trialDaysLeft(subscription);

  if (daysLeft === null || daysLeft > 7) return null;
  if (subscription?.stripe_subscription_id) return null;

  const urgent = daysLeft <= 3;

  return (
    <Link href="/billing" style={urgent ? urgentStyle : calmStyle}>
      <span className={mono.className} style={{ fontSize: 11, letterSpacing: "0.06em" }}>
        {daysLeft === 0
          ? "TRIAL ENDS TODAY"
          : `${daysLeft} ${daysLeft === 1 ? "DAY" : "DAYS"} LEFT ON YOUR TRIAL`}
      </span>
      <span style={{ fontSize: 13 }}>Set up payment →</span>
    </Link>
  );
}

const base = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 3,
  marginTop: 14,
  textDecoration: "none",
};

const calmStyle = {
  ...base,
  background: "#fff",
  border: "1px solid #e2e2e2",
  color: "#000",
};

const urgentStyle = {
  ...base,
  background: "#fef3c7",
  border: "1px solid #fde68a",
  color: "#92400e",
};
