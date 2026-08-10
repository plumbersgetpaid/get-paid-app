import { supabaseAdmin } from "../lib/supabaseClient";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getTodayInLondon } from "../lib/today";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function ymdToUTCDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function utcDateToYMD(date) {
  return date.toISOString().slice(0, 10);
}
function addDaysUTC(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function formatUTC(date, mode) {
  const d = date.getUTCDate();
  const m = MONTH_NAMES[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  const wd = WEEKDAY_NAMES[date.getUTCDay()];
  if (mode === "weekday") return `${wd} ${d} ${m}`;
  if (mode === "monthYear") return `${m} ${y}`;
  return `${d} ${m}`;
}

function getDateRange(range, offset, todayStr) {
  const today = ymdToUTCDate(todayStr);

  if (range === "week") {
    const day = addDaysUTC(today, offset * 7);
    const dow = day.getUTCDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = addDaysUTC(day, diffToMonday);
    return { start: monday, end: addDaysUTC(monday, 6) };
  }

  if (range === "month") {
    const day = addDaysUTC(today, 0);
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + offset, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    return { start, end };
  }

  // "today" - single day
  const day = addDaysUTC(today, offset);
  return { start: day, end: day };
}

export default async function Calendar({ searchParams }) {
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();
  const todayStr = getTodayInLondon();

  const range = ["today", "week", "month"].includes(searchParams?.range)
    ? searchParams.range
    : "week";
  const offset = parseInt(searchParams?.offset || "0", 10) || 0;

  const { start, end } = getDateRange(range, offset, todayStr);
  const rangeStartStr = utcDateToYMD(start);
  const rangeEndStr = utcDateToYMD(end);

  const rangeLabel =
    range === "today"
      ? formatUTC(start, "weekday")
      : range === "month"
      ? formatUTC(start, "monthYear")
      : `${formatUTC(start)} – ${formatUTC(end)}`;

  const { data: scheduledJobs } = await db
    .from("jobs")
    .select("*")
    .eq("status", "in_progress")
    .not("scheduled_start", "is", null)
    .gte("scheduled_start", `${rangeStartStr}T00:00:00`)
    .lte("scheduled_start", `${rangeEndStr}T23:59:59`)
    .order("scheduled_start", { ascending: true });

  const jobs = scheduledJobs || [];

  const jobCustomerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const { data: jobCustomers } = jobCustomerIds.length
    ? await db.from("customers").select("id, name").in("id", jobCustomerIds)
    : { data: [] };
  const jobCustomerName = Object.fromEntries((jobCustomers || []).map((c) => [c.id, c.name]));

  const { data: outstandingInvoices } = await db
    .from("outstanding_invoices")
    .select("*")
    .gte("due_date", rangeStartStr)
    .lte("due_date", rangeEndStr)
    .order("due_date", { ascending: true });

  const { data: reminders } = await db
    .from("personal_events")
    .select("*")
    .gte("scheduled_start", `${rangeStartStr}T00:00:00`)
    .lte("scheduled_start", `${rangeEndStr}T23:59:59`)
    .order("scheduled_start", { ascending: true });

  // Combine job bookings, payment due dates, and reminders into one
  // date-grouped timeline
  const entriesByDate = {};

  for (const job of jobs) {
    const dateKey = job.scheduled_start.slice(0, 10);
    if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];

    const startDateObj = new Date(job.scheduled_start);
    const endDateObj = new Date(job.scheduled_end);
    const sameDay = startDateObj.toDateString() === endDateObj.toDateString();
    const completionLabel = sameDay
      ? `finishes ~${endDateObj.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : `expected completion ${endDateObj.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}`;

    entriesByDate[dateKey].push({
      type: "job",
      time: startDateObj.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      label: `${jobCustomerName[job.customer_id] || "Customer"} - ${
        job.job_type || "Job"
      } (${completionLabel})`,
      href: `/jobs/schedule/${job.id}`,
    });
  }

  for (const inv of outstandingInvoices || []) {
    const dateKey = inv.due_date;
    if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
    entriesByDate[dateKey].push({
      type: "payment",
      time: null,
      label: `${inv.customer_name} - ${formatCurrency(inv.amount, settings.currency)} due`,
      href: `/invoices/${inv.invoice_id}`,
    });
  }

  for (const reminder of reminders || []) {
    const dateKey = reminder.scheduled_start.slice(0, 10);
    if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
    entriesByDate[dateKey].push({
      type: "reminder",
      time: new Date(reminder.scheduled_start).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      label: reminder.title,
      href: `/calendar/reminder/${reminder.id}`,
    });
  }

  const sortedDates = Object.keys(entriesByDate).sort();

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Calendar</h1>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "16px 0" }}>
        <Link href="/calendar/quick-book" style={quickBookButtonStyle}>
          + Quick book
        </Link>
        <Link href="/calendar/reminder/new" style={reminderButtonStyle}>
          + Reminder
        </Link>
      </div>

      <div style={rangeTabRowStyle}>
        <Link href="/calendar?range=today" style={rangeTabStyle(range === "today")}>
          Today
        </Link>
        <Link href="/calendar?range=week" style={rangeTabStyle(range === "week")}>
          Week
        </Link>
        <Link href="/calendar?range=month" style={rangeTabStyle(range === "month")}>
          Month
        </Link>
      </div>

      <div style={stepRowStyle}>
        <Link href={`/calendar?range=${range}&offset=${offset - 1}`} style={stepButtonStyle}>
          ‹
        </Link>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{rangeLabel}</div>
        <Link href={`/calendar?range=${range}&offset=${offset + 1}`} style={stepButtonStyle}>
          ›
        </Link>
      </div>
      {offset !== 0 && (
        <Link href={`/calendar?range=${range}&offset=0`} style={jumpToTodayStyle}>
          Jump to today
        </Link>
      )}

      <p style={{ fontSize: 13, color: "#888", marginTop: 12 }}>
        🔧 booked jobs, 💰 payment due dates, and 📌 personal reminders.
      </p>

      {sortedDates.length === 0 && (
        <p style={{ color: "#888", marginTop: 20 }}>Nothing on for this {range}.</p>
      )}

      {sortedDates.map((dateKey) => {
        const isToday = dateKey === todayStr;
        const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });

        return (
          <section key={dateKey} style={dayCardStyle(isToday)}>
            <div style={dayHeaderStyle(isToday)}>
              {isToday && <span style={todayBadgeStyle}>TODAY</span>}
              {dateLabel}
            </div>
            <div style={{ padding: "10px 12px 12px" }}>
              {entriesByDate[dateKey]
                .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                .map((entry, i) => (
                  <Link key={i} href={entry.href} style={entryRowStyle(entry.type)}>
                    <span style={{ marginRight: 8 }}>
                      {entry.type === "job" ? "🔧" : entry.type === "payment" ? "💰" : "📌"}
                    </span>
                    {entry.time && (
                      <span style={{ color: "#888", marginRight: 8 }}>{entry.time}</span>
                    )}
                    {entry.label}
                  </Link>
                ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

const backButtonStyle = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#111",
};

const quickBookButtonStyle = {
  flex: 1,
  textAlign: "center",
  background: "#111",
  color: "white",
  padding: "12px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 600,
};

const reminderButtonStyle = {
  flex: 1,
  textAlign: "center",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "12px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 600,
};

const rangeTabRowStyle = { display: "flex", gap: 8, marginTop: 4 };

const rangeTabStyle = (active) => ({
  flex: 1,
  textAlign: "center",
  padding: "8px 0",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
  background: active ? "#111" : "white",
  color: active ? "white" : "#111",
});

const stepRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 14,
};

const stepButtonStyle = {
  width: 36,
  height: 36,
  borderRadius: 18,
  background: "white",
  color: "#111",
  fontSize: 18,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const jumpToTodayStyle = {
  display: "block",
  textAlign: "center",
  fontSize: 12,
  color: "#666",
  textDecoration: "underline",
  marginTop: 6,
};

const dayCardStyle = (isToday) => ({
  background: "white",
  borderRadius: 12,
  marginBottom: 16,
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: isToday ? "2px solid #111" : "1px solid transparent",
});

const dayHeaderStyle = (isToday) => ({
  background: isToday ? "#111" : "#eef0f3",
  color: isToday ? "white" : "#111",
  fontSize: 15,
  fontWeight: 700,
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: 8,
});

const todayBadgeStyle = {
  background: "white",
  color: "#111",
  fontSize: 10,
  fontWeight: 800,
  padding: "2px 6px",
  borderRadius: 4,
  letterSpacing: 0.5,
};

const entryRowStyle = (type) => ({
  display: "block",
  background: "white",
  border: "1px solid #eee",
  borderLeft: `4px solid ${
    type === "job" ? "#2563eb" : type === "payment" ? "#dc2626" : "#9333ea"
  }`,
  borderRadius: 6,
  padding: "10px 12px",
  marginTop: 8,
  textDecoration: "none",
  color: "#111",
  fontSize: 14,
});
