import BackButton from "../components/BackButton";
import BillingActions from "./BillingActions";
import PostCheckout from "./PostCheckout";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything } from "../lib/permissions";
import { getSubscription, countActiveSeats } from "../lib/getSubscription";
import { trialDaysLeft, monthlyTotal, hasAccess } from "../lib/stripe";
import { notFound } from "next/navigation";
import { c, mono } from "../lib/theme";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const STATUS_COPY = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment failed",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Incomplete",
};

export default async function Billing(props) {
  const searchParams = await props.searchParams;
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  const subscription = await getSubscription(currentMember.business_id);
  const seats = await countActiveSeats(currentMember.business_id);
  const daysLeft = trialDaysLeft(subscription);
  const active = hasAccess(subscription);
  const justPaid = searchParams?.done === "1";

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          Billing
        </h1>
      </div>

      {justPaid &&
        (subscription?.stripe_subscription_id ? (
          <div style={successStyle}>
            That&apos;s sorted - your subscription is set up.
          </div>
        ) : (
          <PostCheckout alreadyActive={false} />
        ))}

      <section style={cardStyle}>
        <div className={mono.className} style={labelStyle}>
          CURRENT PLAN
        </div>

        <div style={{ fontWeight: 300, fontSize: 40, letterSpacing: "-0.04em", marginTop: 10 }}>
          £{monthlyTotal(seats)}
        </div>
        <div className={mono.className} style={subLabelStyle}>
          PER MONTH · {seats} {seats === 1 ? "PERSON" : "PEOPLE"}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${c.hairline}` }}>
          <div className={mono.className} style={statusRowStyle}>
            <span>STATUS</span>
            <span style={{ color: active ? c.green : c.red }}>
              {(STATUS_COPY[subscription?.status] || "None").toUpperCase()}
            </span>
          </div>

          {daysLeft !== null && (
            <div className={mono.className} style={statusRowStyle}>
              <span>TRIAL ENDS</span>
              <span>
                {daysLeft === 0
                  ? "TODAY"
                  : `${daysLeft} ${daysLeft === 1 ? "DAY" : "DAYS"} LEFT`}
              </span>
            </div>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <div className={mono.className} style={labelStyle}>
          HOW IT ADDS UP
        </div>
        <p style={bodyStyle}>
          £19 a month covers you, and every extra person on the team is £8.
          The count follows whoever&apos;s active in Team settings, so adding
          someone updates the bill automatically.
        </p>
        <BillingActions hasSubscription={Boolean(subscription?.stripe_subscription_id)} />
      </section>

      {/* Cancelling happens inside Stripe's portal, which we don't control
          and can't put a warning inside. So the warning has to be here,
          before anyone gets that far - and next to the export, because
          "your data will be deleted" is only fair if taking it with you is
          one tap away rather than something to go and find. */}
      <section style={cardStyle}>
        <div className={mono.className} style={labelStyle}>
          IF YOU LEAVE
        </div>
        <p style={bodyStyle}>
          Cancel whenever you like - there&apos;s no notice period and no exit
          fee. You keep access until the end of the period you&apos;ve paid for.
        </p>
        <p style={bodyStyle}>
          <strong>Thirty days after you cancel, everything is deleted.</strong>{" "}
          Clients, jobs, quotes, invoices, photos, notes - permanently, from
          our systems and our backups. We keep only the billing record, which
          UK tax rules require us to hold for six years.
        </p>
        <p style={bodyStyle}>
          Download your records first. Your invoices are your own tax
          documents and HMRC expects you to keep them for six years, so this
          isn&apos;t something to leave until afterwards - afterwards is too
          late.
        </p>
        <a href="/api/export/everything" style={exportButtonStyle}>
          Download everything
        </a>
        <p style={{ ...bodyStyle, fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          One zip file: spreadsheets of your clients, jobs, quotes and
          invoices with payment dates, plus the job photos. Opens in Excel,
          Numbers or Google Sheets. Large libraries may take a minute.
        </p>
      </section>
    </main>
  );
}

const exportButtonStyle = {
  display: "block",
  textAlign: "center",
  background: c.ink,
  color: c.paper,
  padding: "14px",
  borderRadius: 2,
  textDecoration: "none",
  fontWeight: 500,
  fontSize: 14.5,
  marginTop: 4,
};

const cardStyle = {
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 3,
  padding: "var(--card-pad, 16px)",
  marginTop: 14,
};

const labelStyle = {
  fontSize: 10.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: c.mid,
};

const subLabelStyle = {
  fontSize: 11.5,
  color: c.mid,
  marginTop: 9,
  letterSpacing: "0.04em",
};

const statusRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11.5,
  letterSpacing: "0.04em",
  color: c.mid,
  padding: "7px 0",
};

const bodyStyle = {
  fontSize: 14,
  color: c.mid,
  lineHeight: 1.55,
  margin: "10px 0 18px",
};

const successStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
  marginTop: 14,
};
