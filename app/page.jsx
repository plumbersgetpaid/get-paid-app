import { supabaseAdmin } from "./lib/supabaseClient";
import { getBusinessSettings } from "./lib/getBusinessSettings";
import { formatCurrency } from "./lib/formatCurrency";
import { getTodayInLondon } from "./lib/today";
import { getCurrentTeamMember } from "./lib/auth";
import { canSeeEverything, canInvoice } from "./lib/permissions";
import { getScopedDb } from "./lib/scopedSupabaseClient";
import Greeting from "./components/Greeting";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Today() {
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);

  const db = await getScopedDb(currentMember);
  const adminDb = supabaseAdmin();

  const settings = await getBusinessSettings();
  const todayStr = getTodayInLondon();

  const { data: outstanding } = canInvoice(currentMember)
    ? await adminDb.from("outstanding_invoices").select("*")
    : { data: [] };
  const totalOwed = (outstanding || []).reduce((sum, i) => sum + Number(i.amount), 0);
  const dueOrOverdueInvoices = (outstanding || []).filter((i) => i.days_overdue >= 0);
  const overdueAmount = dueOrOverdueInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  const { data: quotes } = showEverything
    ? await db.from("jobs").select("id").eq("status", "quote_sent")
    : { data: [] };

  let activeJobsQuery = db.from("jobs").select("*").eq("status", "in_progress");
  if (!showEverything) {
    activeJobsQuery = activeJobsQuery.eq("assigned_to", currentMember?.id || "__none__");
  }
  const { data: activeJobs } = await activeJobsQuery;

  const jobsToday = (activeJobs || []).filter(
    (j) => j.scheduled_start && j.scheduled_start.slice(0, 10) === todayStr
  );
  const needsBooking = (activeJobs || []).filter((j) => !j.scheduled_start);
  const now = new Date();
  const lateJobs = (activeJobs || []).filter(
    (j) => j.time_confirmed !== false && j.scheduled_end && new Date(j.scheduled_end) < now
  );
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
        icon: "🔧",
        label: `${jobCustomerNameById[j.customer_id] || "Customer"} · ${j.job_type || "Job"}`,
        href: timeConfirmed
          ? `/jobs/complete/${j.id}?from=today`
          : `/jobs/schedule/${j.id}`,
      };
    }),
    ...(remindersToday || []).map((r) => ({
      time: r.scheduled_start,
      timeConfirmed: true,
      icon: "📌",
      label: r.title,
      href: `/calendar/reminder/${r.id}`,
    })),
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  const quotesCount = (quotes || []).length;
  const needsBookingCount = needsBooking.length;
  const overdueCount = dueOrOverdueInvoices.length;
  const lateCount = lateJobs.length;
  const needsTimeCount = needsTimeJobs.length;
  const allClear =
    quotesCount === 0 &&
    needsBookingCount === 0 &&
    overdueCount === 0 &&
    lateCount === 0 &&
    needsTimeCount === 0;

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Greeting />
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/account" aria-label="My account" style={settingsIconStyle}>
            👤
          </Link>
          {showEverything && (
            <Link href="/settings" aria-label="Settings" style={settingsIconStyle}>
              ⚙️
            </Link>
          )}
        </div>
      </div>

      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Today's schedule</div>
        {agenda.length === 0 && (
          <p style={{ color: "#888", fontSize: 14, margin: "10px 0 0" }}>
            Nothing booked in for today.
          </p>
        )}
        {agenda.map((item, i) => (
          <Link key={i} href={item.href} style={agendaRowStyle}>
            <span style={{ fontWeight: 700, minWidth: 54 }}>
              {item.timeConfirmed
                ? new Date(item.time).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "⏰ TBC"}
            </span>
            <span>
              {item.icon} {item.label}
            </span>
          </Link>
        ))}
        <Link href="/calendar" style={cardLinkStyle}>
          View calendar →
        </Link>
      </section>

      {allClear ? (
        <section style={allClearCardStyle}>
          {showEverything
            ? "✓ Quotes, jobs, and invoices are all up to date"
            : "✓ You're all caught up"}
        </section>
      ) : (
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Action needed</div>
          {showEverything && quotesCount > 0 && (
            <Link href="/work?tab=quotes" style={attentionRowStyle}>
              🟠 {quotesCount} quote{quotesCount === 1 ? "" : "s"} need
              {quotesCount === 1 ? "s" : ""} a reply or chase
            </Link>
          )}
          {lateCount > 0 && (
            <Link href="/jobs?status=late" style={attentionRowStyle}>
              🔴 {lateCount} job{lateCount === 1 ? "" : "s"} running late
            </Link>
          )}
          {needsTimeCount > 0 && (
            <Link href="/jobs?status=needs-time" style={attentionRowStyle}>
              🟡 {needsTimeCount} job{needsTimeCount === 1 ? "" : "s"} still need
              {needsTimeCount === 1 ? "s" : ""} a time set
            </Link>
          )}
          {needsBookingCount > 0 && (
            <Link href="/jobs?status=unscheduled" style={attentionRowStyle}>
              🔵 {needsBookingCount} job{needsBookingCount === 1 ? "" : "s"} need
              {needsBookingCount === 1 ? "s" : ""} booking in
            </Link>
          )}
          {canInvoice(currentMember) && overdueCount > 0 && (
            <Link href="/work?tab=invoices" style={attentionRowStyle}>
              🔴 {overdueCount} invoice{overdueCount === 1 ? "" : "s"} due or overdue
            </Link>
          )}
        </section>
      )}

      {showEverything && (
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Outstanding payments</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>
            {formatCurrency(totalOwed, settings.currency)}{" "}
            <span style={{ fontSize: 14, fontWeight: 400, color: "#888" }}>awaiting</span>
          </div>
          {overdueAmount > 0 && (
            <div style={{ fontSize: 14, color: "#dc2626", marginTop: 2 }}>
              {formatCurrency(overdueAmount, settings.currency)} overdue
            </div>
          )}
                   <Link href="/work?tab=invoices" style={cardLinkStyle}>
            View invoices →
          </Link>
        </section>
      )}

      <div style={{ textAlign: "center", padding: "24px 0 8px", opacity: 0.35 }}>
        <svg width="20" height="20" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
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
      </div>
    </main>
  );
}

const settingsIconStyle = {
  width: 36,
  height: 36,
  borderRadius: 18,
  background: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const sectionTitleStyle = {
  fontSize: 15,
  fontWeight: 700,
};

const cardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const agendaRowStyle = {
  display: "flex",
  gap: 10,
  padding: "10px 0",
  borderTop: "1px solid #f3f3f3",
  textDecoration: "none",
  color: "#111",
  fontSize: 14,
};

const cardLinkStyle = {
  display: "block",
  fontSize: 12,
  color: "#666",
  textDecoration: "underline",
  marginTop: 10,
};

const attentionRowStyle = {
  display: "block",
  padding: "10px 0",
  borderTop: "1px solid #f3f3f3",
  textDecoration: "none",
  color: "#111",
  fontSize: 15,
  fontWeight: 600,
};

const allClearCardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 20,
  marginTop: 16,
  textAlign: "center",
  color: "#16a34a",
  fontWeight: 700,
  fontSize: 15,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};
