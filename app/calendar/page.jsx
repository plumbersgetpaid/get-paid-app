import { supabaseAdmin } from "../lib/supabaseClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Calendar() {
  const db = supabaseAdmin();

  const { data: scheduledJobs } = await db
    .from("jobs")
    .select("*")
    .eq("status", "in_progress")
    .not("scheduled_start", "is", null)
    .order("scheduled_start", { ascending: true });

  const jobs = scheduledJobs || [];

  const jobCustomerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const { data: jobCustomers } = jobCustomerIds.length
    ? await db.from("customers").select("id, name").in("id", jobCustomerIds)
    : { data: [] };
  const jobCustomerName = Object.fromEntries(
    (jobCustomers || []).map((c) => [c.id, c.name])
  );

  const { data: outstandingInvoices } = await db
    .from("outstanding_invoices")
    .select("*")
    .order("due_date", { ascending: true });

  // Combine job bookings and payment due dates into one date-grouped
  // timeline, so work and money are visible on the same screen
  const entriesByDate = {};

  for (const job of jobs) {
    const dateKey = job.scheduled_start.slice(0, 10);
    if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
    entriesByDate[dateKey].push({
      type: "job",
      time: new Date(job.scheduled_start).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      label: `${jobCustomerName[job.customer_id] || "Customer"} - ${
        job.job_type || "Job"
      }`,
      href: `/jobs/schedule/${job.id}`,
    });
  }

  for (const inv of outstandingInvoices || []) {
    const dateKey = inv.due_date;
    if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
    entriesByDate[dateKey].push({
      type: "payment",
      time: null,
      label: `${inv.customer_name} - £${inv.amount} due`,
      href: `/invoices/${inv.invoice_id}`,
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

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        🔧 booked jobs and 💰 payment due dates, in one place.
      </p>

      {sortedDates.length === 0 && (
        <p style={{ color: "#888", marginTop: 20 }}>
          Nothing booked in yet - jobs you schedule and payments that are due
          will show up here.
        </p>
      )}

      {sortedDates.map((dateKey) => {
        const dateLabel = new Date(dateKey).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });

        return (
          <section key={dateKey} style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#444",
                marginBottom: 6,
              }}
            >
              {dateLabel}
            </div>
            {entriesByDate[dateKey]
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
              .map((entry, i) => (
                <Link
                  key={i}
                  href={entry.href}
                  style={{
                    display: "block",
                    background: "white",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 6,
                    textDecoration: "none",
                    color: "#111",
                    fontSize: 14,
                  }}
                >
                  <span style={{ marginRight: 8 }}>
                    {entry.type === "job" ? "🔧" : "💰"}
                  </span>
                  {entry.time && (
                    <span style={{ color: "#888", marginRight: 8 }}>
                      {entry.time}
                    </span>
                  )}
                  {entry.label}
                </Link>
              ))}
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
