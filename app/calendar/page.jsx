import { supabaseAdmin } from "../lib/supabaseClient";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getTodayInLondon } from "../lib/today";
import { advanceDate } from "../lib/duration";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything } from "../lib/permissions";
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

  const day = addDaysUTC(today, offset);
  return { start: day, end: day };
}

function projectRecurringOccurrences(nextOccurrence, value, unit, rangeStartStr, rangeEndStr) {
  const dates = [];
  let current = nextOccurrence;
  let guard = 0;
  while (current <= rangeEndStr && guard < 60) {
    if (current >= rangeStartStr) dates.push(current);
    current = advanceDate(current, value, unit);
    guard += 1;
  }
  return dates;
}

export default async function Calendar({ searchParams }) {
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();
  const todayStr = getTodayInLondon();
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);

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

  let scheduledJobsQuery = db
    .from("jobs")
    .select("*")
    .eq("status", "in_progress")
    .not("scheduled_start", "is", null)
    .gte("scheduled_start", `${rangeStartStr}T00:00:00`)
    .lte("scheduled_start", `${rangeEndStr}T23:59:59`)
    .order("scheduled_start", { ascending: true });
  if (!showEverything) {
    scheduledJobsQuery = scheduledJobsQuery.eq("assigned_to", currentMember?.id || "__none__");
  }
  const { data: scheduledJobs } = await scheduledJobsQuery;

  const jobs = scheduledJobs || [];

  const jobCustomerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const { data: jobCustomers } = jobCustomerIds.length
    ? await db.from("customers").select("id, name").in("id", jobCustomerIds)
    : { data: [] };
  const jobCustomerName = Object.fromEntries((jobCustomers || []).map((c) => [c.id, c.name]));

  const { data: outstandingInvoices } = showEverything
    ? await db
        .from("outstanding_invoices")
        .select("*")
        .gte("due_date", rangeStartStr)
        .lte("due_date", rangeEndStr)
        .order("due_date", { ascending: true })
    : { data: [] };

  const { data: reminders } = await db
    .from("personal_events")
    .select("*")
    .gte("scheduled_start", `${rangeStartStr}T00:00:00`)
    .lte("scheduled_start", `${rangeEndStr}T23:59:59`)
    .order("scheduled_start", { ascending: true });

  const { data: recurringJobs } = await db
    .from("recurring_jobs")
    .select("*")
    .eq("active", true);

  const recurringCustomerIds = [...new Set((recurringJobs || []).map((r) => r.customer_id))];
  const { data: recurringCustomers } = recurringCustomerIds.length
    ? await db.from("customers").select("id, name").in("id", recurringCustomerIds)
    : { data: [] };
  const recurringCustomerName = Object.fromEntries(
    (recurringCustomers || []).map((c) => [c.id, c.name])
  );

  const entriesByDate = {};
  const now = new Date();

  const formatLateness = (scheduledEnd) => {
    const diffHours = (now - new Date(scheduledEnd)) / (1000 * 60 * 60);
    if (diffHours < 1) return "under an hour late";
    if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      return `${hours} hour${hours === 1 ? "" : "s"} late`;
    }
    const days = Math.floor(diffHours / 24);
    return `${days} day${days === 1 ? "" : "s"} late`;
  };

  for (const job of jobs) {
    const dateKey = job.scheduled_start.slice(0, 10);
    if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];

    const startDateObj = new Date(job.scheduled_start);
    const endDateObj = new Date(job.scheduled_end);
    const timeUnconfirmed = job.time_confirmed === false;
    const isLate = !timeUnconfirmed && endDateObj < now;
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
      type: isLate ? "job-late" : "job",
      time: timeUnconfirmed
        ? null
        : startDateObj.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      label: timeUnconfirmed
        ? `${jobCustomerName[job.customer_id] || "Customer"} - ${
            job.job_type || "Job"
          } (⏰ time to be confirmed)`
        : isLate
        ? `${jobCustomerName[job.customer_id] || "Customer"} - ${
            job.job_type || "Job"
          } (⚠️ ${formatLateness(job.scheduled_end)} - tap to mark done)`
        : `${jobCustomerName[job.customer_id] || "Customer"} - ${
            job.job_type || "Job"
          } (${completionLabel})`,
      href: isLate ? `/jobs/complete/${job.id}` : `/jobs/schedule/${job.id}`,
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

  for (const r of recurringJobs || []) {
    const occurrenceDates = projectRecurringOccurrences(
      r.next_occurrence,
      r.frequency_value,
      r.frequency_unit,
      rangeStartStr,
      rangeEndStr
    );
    for (const dateKey of occurrenceDates) {
      if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
      entriesByDate[dateKey].push({
        type: "recurring",
        time: null,
        label: `${recurringCustomerName[r.customer_id] || "Customer"} - ${
          r.job_type || "Job"
        } (repeats here
