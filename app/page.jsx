import { supabaseAdmin } from "./lib/supabaseClient";
import { getBusinessSettings } from "./lib/getBusinessSettings";
import { getPlatformSettings } from "./lib/getPlatformSettings";
import { formatCurrency } from "./lib/formatCurrency";
import { getTodayInLondon } from "./lib/today";
import { getCurrentTeamMember } from "./lib/auth";
import { canSeeEverything, canInvoice } from "./lib/permissions";
import { getScopedDb } from "./lib/scopedSupabaseClient";
import Greeting from "./components/Greeting";
import TrialBanner from "./components/TrialBanner";
import Icon from "./components/Icon";
import {
  c,
  cardStyle as sharedCard,
  sectionLabelStyle,
  bigNumberStyle,
  statusBarStyle,
  silverSurfaceStyle,
  mono,
} from "./lib/theme";
import Link from "next/link";
import { nowInLondonFrame } from "./lib/today";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Today() {
  // Fetched ahead of the scoped client - it needs to know who's logged
  // in (and their business) before it can even be constructed, so this
  // can no longer come after db the way it originally did.
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);
  const platformSettings = await getPlatformSettings();

  const db = await getScopedDb(currentMember);
  // outstanding_invoices is a database view, not a direct table - kept
  // on the service-role client until its own RLS behaviour through the
  // view has been specifically verified, same reasoning as Calendar and
  // Work → Invoices
  const adminDb = supabaseAdmin();

  const settings = await getBusinessSettings();
  const todayStr = getTodayInLondon();

  // Outstanding payments are financial information - fetched for
  // canInvoice, not just showEverything, since someone granted the
  // specific can_invoice permission can already see individual overdue
  // invoices via the Invoices tab itself - not surfacing that same
  // information as an actionable alert here would be an inconsistency,
  // not extra protection. The full £-total summary card further down
  // stays showEverything-only regardless - that's a broader financial
  // overview, not a specific invoicing action.
  const { data: outstanding } = canInvoice(currentMember)
    ? await adminDb
        .from("outstanding_invoices")
        .select("*")
        .eq("business_id", currentMember.business_id)
    : { data: [] };
  // Balance still owed, not the full invoice value - a received deposit
  // has already been paid (deposit columns absent pre-migration -> 0).
  const totalOwed = (outstanding || []).reduce(
    (sum, i) => sum + Math.max(0, Number(i.amount) - (Number(i.deposit_amount) || 0)),
    0
  );
  // "Needs attention" for invoices due today or already overdue - not just
  // strictly overdue, so a payment due today doesn't get missed
  const dueOrOverdueInvoices = (outstanding || []).filter((i) => i.days_overdue >= 0);
  const overdueAmount = dueOrOverdueInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  // Quotes are unbooked, price-centric items - same treatment as
  // invoices, skipped entirely for a subcontractor
  const { data: quotes } = showEverything
    ? await db.from("jobs").select("id").eq("status", "quote_sent")
    : { data: [] };

  let activeJobsQuery = db.from("jobs").select("*").eq("status", "in_progress");
  // Same rule as everywhere else - a subcontractor's view of the
  // dashboard only ever reflects jobs specifically assigned to them
  if (!showEverything) {
    activeJobsQuery = activeJobsQuery.eq("assigned_to", currentMember?.id || "__none__");
  }
  const { data: activeJobs } = await activeJobsQuery;

  const jobsToday = (activeJobs || []).filter(
    (j) => j.scheduled_start && j.scheduled_start.slice(0, 10) === todayStr
  );
  const needsBooking = (activeJobs || []).filter((j) => !j.scheduled_start);
  const now = nowInLondonFrame();
  const lateJobs = (activeJobs || []).filter(
    (j) => j.time_confirmed !== false && j.scheduled_end && new Date(j.scheduled_end) < now
  );
  // Jobs whose date has arrived (today or already passed) but the actual
  // time was never confirmed - these need an active nudge, not just a
  // passive "TBC" sitting quietly on the calendar
  const needsTimeJobs = (activeJobs || []).filter(
    (j) =>
      j.time_confirmed === false && j.scheduled_start && j.scheduled_start.slice(0, 10) <= todayStr
  );

  const jobCustomerIds = [...new Set(jobsToday.map((j) => j.customer_id))];
  const { data: jobCustomers } = jobCustomerIds.length
    ? await db.from("customers").select("id, name").in("id", jobCustomerIds)
    : { data: [] };
  const jobCustomerNameById = Object.fromEntries(
    (jobCustomers || []).map((c) => [c.id, c.name])
  );

  // Reminders are private to whoever made them, same rule as Calendar
  const { data: remindersToday } = await db
    .from("personal_events")
    .select("*")
    .eq("created_by", currentMember?.id || "__none__")
    .gte("scheduled_start", `${todayStr}T00:00:00`)
    .lte("scheduled_start", `${todayStr}T23:59:59`);

  const agenda = [
    ...jobsToday.map((j) => {
      const timeConfirmed = j.time_confirmed !== false;
      return {
        time: j.scheduled_start,
        timeConfirmed,
        icon: "job",
        label: `${jobCustomerNameById[j.customer_id] || "Customer"} · ${j.job_type || "Job"}`,
        // If the time still needs setting, take them to set it - only once
        // it's confirmed does tapping the job mean "mark it done"
        href: timeConfirmed
          ? `/jobs/complete/${j.id}?from=today`
          : `/jobs/schedule/${j.id}`,
      };
    }),
    ...(remindersToday || []).map((r) => ({
      time: r.scheduled_start,
      timeConfirmed: true,
      icon: "pin",
      label: r.title,
      href: `/calendar/reminder/${r.id}`,
    })),
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  const quotesCount = (quotes || []).length;
  const needsBookingCount = needsBooking.length;
  // Deposits asked for but not yet received, on live jobs. Money-adjacent,
  // so gated on canInvoice like the invoice rows. deposit_amount is simply
  // undefined pre-migration, which counts nothing.
  const awaitingDepositCount = canInvoice(currentMember)
    ? (activeJobs || []).filter((j) => j.deposit_amount && !j.deposit_received_on).length
    : 0;
  const overdueCount = dueOrOverdueInvoices.length;
  const lateCount = lateJobs.length;
  const needsTimeCount = needsTimeJobs.length;
  // No separate visibility branching needed here - quotesCount is
  // already guaranteed 0 for anyone without showEverything (the quotes
  // query itself is gated), and overdueCount is already guaranteed 0
  // for anyone without canInvoice (the outstanding-invoices query is
  // gated the same way) - so a plain AND-chain across all five already
  // does the right thing for every permission combination automatically,
  // without this calculation needing its own copy of that same logic.
  const allClear =
    quotesCount === 0 &&
    needsBookingCount === 0 &&
    overdueCount === 0 &&
    lateCount === 0 &&
    needsTimeCount === 0 &&
    awaitingDepositCount === 0;

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Greeting />
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/account" aria-label="My account" style={settingsIconStyle}>
            <Icon name="person" size={16} color="#000" strokeWidth={1.6} />
          </Link>
          {showEverything && (
            <Link href="/settings" aria-label="Settings" style={settingsIconStyle}>
              <Icon name="settings" size={16} color="#000" strokeWidth={1.6} />
            </Link>
          )}
        </div>
      </div>

      <TrialBanner />

      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Today's schedule</div>
        {agenda.length === 0 && (
          <p style={{ color: "#888", fontSize: 14, margin: "10px 0 0" }}>
            Nothing booked in for today.
          </p>
        )}
        {agenda.map((item, i) => (
          <Link key={i} href={item.href} style={agendaRowStyle}>
            <span className={mono.className} style={timeStyle}>
              {item.timeConfirmed
                ? new Date(item.time).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "TBC"}
            </span>
            <Icon name={item.icon} size={15} strokeWidth={1.6} />
            <span>{item.label}</span>
          </Link>
        ))}
        <Link href="/calendar" style={cardLinkStyle}>
          View calendar →
        </Link>
      </section>

      {allClear ? (
        <section style={allClearCardStyle}>
          {showEverything
            ? "Quotes, jobs and invoices are all up to date"
            : "You're all caught up"}
        </section>
      ) : (
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Action needed</div>
          {showEverything && quotesCount > 0 && (
            <Link href="/work?tab=quotes" style={attentionRowStyle}>
              <span style={statusBarStyle(c.amber)} />
              <span>
                {quotesCount} quote{quotesCount === 1 ? "" : "s"} need
                {quotesCount === 1 ? "s" : ""} a reply or chase
              </span>
            </Link>
          )}
          {lateCount > 0 && (
            <Link href="/jobs?status=late" style={attentionRowStyle}>
              <span style={statusBarStyle(c.red)} />
              <span>
                {lateCount} job{lateCount === 1 ? "" : "s"} running late
              </span>
            </Link>
          )}
          {needsTimeCount > 0 && (
            <Link href="/jobs?status=needs-time" style={attentionRowStyle}>
              <span style={statusBarStyle("#eab308")} />
              <span>
                {needsTimeCount} job{needsTimeCount === 1 ? "" : "s"} still need
                {needsTimeCount === 1 ? "s" : ""} a time set
              </span>
            </Link>
          )}
          {needsBookingCount > 0 && (
            <Link href="/jobs?status=unscheduled" style={attentionRowStyle}>
              <span style={statusBarStyle(c.blue)} />
              <span>
                {needsBookingCount} job{needsBookingCount === 1 ? "" : "s"} need
                {needsBookingCount === 1 ? "s" : ""} booking in
              </span>
            </Link>
          )}
          {awaitingDepositCount > 0 && (
            <Link href="/work?tab=jobs" style={attentionRowStyle}>
              <span style={statusBarStyle(c.amber)} />
              <span>
                {awaitingDepositCount} deposit{awaitingDepositCount === 1 ? "" : "s"} awaiting payment
              </span>
            </Link>
          )}
          {canInvoice(currentMember) && overdueCount > 0 && (
            <Link href="/work?tab=invoices" style={attentionRowStyle}>
              <span style={statusBarStyle(c.red)} />
              <span>
                {overdueCount} invoice{overdueCount === 1 ? "" : "s"} due or overdue
              </span>
            </Link>
          )}
        </section>
      )}

      {showEverything && (
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Outstanding payments</div>
          <div style={{ ...bigNumberStyle, marginTop: 10 }}>
            {formatCurrency(totalOwed, settings.currency)}
          </div>
          <div className={mono.className} style={awaitingStyle}>
            AWAITING PAYMENT
          </div>
          {overdueAmount > 0 && (
            <div className={mono.className} style={overdueStyle}>
              {formatCurrency(overdueAmount, settings.currency)} OVERDUE
            </div>
          )}
          <Link href="/work?tab=invoices" style={cardLinkStyle}>
            View invoices →
          </Link>
        </section>
      )}

      <div style={{ textAlign: "center", padding: "24px 0 8px", opacity: 0.35 }}>
        {platformSettings.sign_off_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={platformSettings.sign_off_logo_url}
            alt=""
            style={{ maxHeight: 40, maxWidth: 180 }}
          />
        ) : (
          <svg width="32" height="32" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="5" width="80" height="80" rx="40" fill="#111" />
            <path
              d="M32 24 L32 66 M32 24 L50 24 A13 13 0 0 1 50 50 L32 50"
              stroke="#d97706"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        )}
      </div>
    </main>
  );
}

const settingsIconStyle = {
  width: 36,
  height: 36,
  borderRadius: 2,
  ...silverSurfaceStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
};

const sectionTitleStyle = sectionLabelStyle;

const cardStyle = sharedCard;

const timeStyle = {
  fontSize: 12,
  fontWeight: 500,
  minWidth: 48,
  letterSpacing: "0.03em",
};

const agendaRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "12px 0",
  borderTop: `1px solid ${c.hairline}`,
  textDecoration: "none",
  color: c.ink,
  fontSize: 14.5,
};

const cardLinkStyle = {
  display: "inline-block",
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: c.mid,
  textDecoration: "none",
  marginTop: 14,
};

const attentionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "12px 0",
  borderTop: `1px solid ${c.hairline}`,
  textDecoration: "none",
  color: c.ink,
  fontSize: 14.5,
};

const awaitingStyle = {
  fontSize: 11.5,
  color: c.mid,
  marginTop: 9,
  letterSpacing: "0.04em",
};

const overdueStyle = {
  fontSize: 12,
  color: c.red,
  marginTop: 7,
  letterSpacing: "0.03em",
};

const allClearCardStyle = {
  ...sharedCard,
  padding: 20,
  textAlign: "center",
  color: c.green,
  fontWeight: 500,
  fontSize: 14.5,
};
