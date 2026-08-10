import { supabaseAdmin } from "../lib/supabaseClient";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getTodayInLondon } from "../lib/today";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Work({ searchParams }) {
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();
  const tab = searchParams?.tab || "quotes";

  return (
    <main>
      <h1 style={{ fontSize: 20, margin: "0 0 16px" }}>Work</h1>

      <div style={tabRowStyle}>
        <Link href="/work?tab=quotes" style={tabStyle(tab === "quotes")}>
          Quotes
        </Link>
        <Link href="/work?tab=jobs" style={tabStyle(tab === "jobs")}>
          Jobs
        </Link>
        <Link href="/work?tab=invoices" style={tabStyle(tab === "invoices")}>
          Invoices
        </Link>
      </div>

      {tab === "quotes" && <QuotesTab db={db} settings={settings} />}
      {tab === "jobs" && <JobsTab db={db} settings={settings} />}
      {tab === "invoices" && <InvoicesTab db={db} settings={settings} />}
    </main>
  );
}

async function QuotesTab({ db, settings }) {
  const { data: rawQuotes } = await db
    .from("jobs")
    .select("*")
    .eq("status", "quote_sent")
    .order("quote_sent_at", { ascending: true });

  let quotes = rawQuotes || [];
  const customerIds = [...new Set(quotes.map((q) => q.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));
  quotes = quotes.map((q) => ({
    ...q,
    customer_name: nameById[q.customer_id] || "Unknown customer",
  }));

  const chasedCount = quotes.filter((q) => q.quote_chased_at).length;

  return (
    <div>
      <div style={statRowStyle}>
        <Link href="/jobs?status=quote_sent" style={statBlockLinkStyle}>
          <div style={statNumberStyle}>{quotes.length}</div>
          <div style={statLabelStyle}>Awaiting response</div>
        </Link>
        <Link href="/jobs?status=quote_sent" style={statBlockLinkStyle}>
          <div style={statNumberStyle}>{chasedCount}</div>
          <div style={statLabelStyle}>Already chased</div>
        </Link>
      </div>

      <form action="/jobs" method="GET" style={searchFormStyle}>
        <input type="hidden" name="status" value="quote_sent" />
        <input type="search" name="q" placeholder="Search quotes" style={searchInputStyle} />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {quotes.length === 0 && <p style={{ color: "#888" }}>No quotes waiting on a reply.</p>}

      {quotes.slice(0, 8).map((q) => (
        <div key={q.id} style={cardStyle("#f59e0b")}>
          <div style={{ fontWeight: 600 }}>{q.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
            {q.job_type || "Job"} · {formatCurrency(q.amount, settings.currency)}
            {q.quote_chased_at ? " · already chased" : ""}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <form action="/api/jobs/accept-quote" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="jobId" value={q.id} />
              <button type="submit" style={primaryButtonStyle}>
                Accept quote
              </button>
            </form>
            <form action="/api/jobs/chase-quote" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="jobId" value={q.id} />
              <button type="submit" style={secondaryButtonStyle}>
                Chase quote
              </button>
            </form>
          </div>
          <form action="/api/jobs/decline-quote" method="POST" style={{ marginTop: 6 }}>
            <input type="hidden" name="jobId" value={q.id} />
            <button type="submit" style={declineLinkStyle}>
              Decline / lost job
            </button>
          </form>
        </div>
      ))}

      {quotes.length > 8 && (
        <Link href="/jobs?status=quote_sent" style={viewAllLinkStyle}>
          View all {quotes.length} quotes →
        </Link>
      )}
    </div>
  );
}

async function JobsTab({ db, settings }) {
  const { data: rawJobs } = await db.from("jobs").select("*").eq("status", "in_progress");
  let jobs = rawJobs || [];
  const customerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));
  jobs = jobs.map((j) => ({
    ...j,
    customer_name: nameById[j.customer_id] || "Unknown customer",
  }));

  const todayStr = getTodayInLondon();
  const todayJobs = jobs.filter(
    (j) => j.scheduled_start && j.scheduled_start.slice(0, 10) === todayStr
  );
  const upcomingJobs = jobs.filter(
    (j) => j.scheduled_start && j.scheduled_start.slice(0, 10) > todayStr
  );
  const unscheduledJobs = jobs.filter((j) => !j.scheduled_start);

  const { count: completedCount } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["complete", "invoiced", "paid"]);

  const photoJobIds = jobs.map((j) => j.id);
  const { data: photoRows } = photoJobIds.length
    ? await db.from("job_photos").select("job_id").in("job_id", photoJobIds)
    : { data: [] };
  const photoCountByJob = {};
  for (const p of photoRows || []) {
    photoCountByJob[p.job_id] = (photoCountByJob[p.job_id] || 0) + 1;
  }

  const displayJobs = [...todayJobs, ...upcomingJobs, ...unscheduledJobs].slice(0, 8);

  return (
    <div>
      <div style={statRowStyle}>
        <div style={statBlockStyle}>
          <div style={statNumberStyle}>{todayJobs.length}</div>
          <div style={statLabelStyle}>Today</div>
        </div>
        <div style={statBlockStyle}>
          <div style={statNumberStyle}>{upcomingJobs.length}</div>
          <div style={statLabelStyle}>Upcoming</div>
        </div>
        <Link href="/jobs?status=unscheduled" style={statBlockLinkStyle}>
          <div style={statNumberStyle}>{unscheduledJobs.length}</div>
          <div style={statLabelStyle}>Unscheduled</div>
        </Link>
        <Link href="/jobs?status=done" style={statBlockLinkStyle}>
          <div style={statNumberStyle}>{completedCount || 0}</div>
          <div style={statLabelStyle}>Completed</div>
        </Link>
      </div>

      <form action="/jobs" method="GET" style={searchFormStyle}>
        <input type="search" name="q" placeholder="Search jobs" style={searchInputStyle} />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {jobs.length === 0 && <p style={{ color: "#888" }}>No jobs in progress.</p>}

      {displayJobs.map((job) => (
        <div key={job.id} style={cardStyle("#2563eb")}>
          <div style={{ fontWeight: 600 }}>{job.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {job.job_type} · {formatCurrency(job.amount, settings.currency)}
          </div>
          {job.scheduled_start && (
            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>
              📅{" "}
              {new Date(job.scheduled_start).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Link href={`/jobs/schedule/${job.id}`} style={secondaryLinkButtonStyle}>
              {job.scheduled_start ? "Reschedule" : "Book in"}
            </Link>
            <Link href={`/jobs/complete/${job.id}`} style={primaryLinkButtonStyle}>
              Mark done
            </Link>
          </div>
          <Link href={`/jobs/photos/${job.id}`} style={photosLinkButtonStyle}>
            📷 Photos{photoCountByJob[job.id] ? ` (${photoCountByJob[job.id]})` : ""}
          </Link>
        </div>
      ))}

      {jobs.length > 8 && (
        <Link href="/jobs?status=in_progress" style={viewAllLinkStyle}>
          View all {jobs.length} jobs in progress →
        </Link>
      )}
    </div>
  );
}

async function InvoicesTab({ db, settings }) {
  const { data: outstanding } = await db
    .from("outstanding_invoices")
    .select("*")
    .order("due_date", { ascending: true });

  const overdue = (outstanding || []).filter((i) => i.days_overdue > 0);
  const notYetDue = (outstanding || []).filter((i) => i.days_overdue <= 0);
  const overdueAmount = overdue.reduce((s, i) => s + Number(i.amount), 0);
  const notYetDueAmount = notYetDue.reduce((s, i) => s + Number(i.amount), 0);

  const { data: paidInvoices } = await db.from("invoices").select("amount").eq("status", "paid");
  const paidTotal = (paidInvoices || []).reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div>
      <Link href="/invoices" style={accountantLinkStyle}>
        📄 Full invoice history &amp; PDF export (for your accountant) →
      </Link>

      <div style={statRowStyle}>
        <Link href="/invoices" style={statBlockLinkStyle}>
          <div style={{ ...statNumberStyle, color: "#dc2626", fontSize: 17 }}>
            {formatCurrency(overdueAmount, settings.currency)}
          </div>
          <div style={statLabelStyle}>Overdue ({overdue.length})</div>
        </Link>
        <Link href="/invoices" style={statBlockLinkStyle}>
          <div style={{ ...statNumberStyle, fontSize: 17 }}>
            {formatCurrency(notYetDueAmount, settings.currency)}
          </div>
          <div style={statLabelStyle}>Awaiting ({notYetDue.length})</div>
        </Link>
        <Link href="/invoices" style={statBlockLinkStyle}>
          <div style={{ ...statNumberStyle, color: "#16a34a", fontSize: 17 }}>
            {formatCurrency(paidTotal, settings.currency)}
          </div>
          <div style={statLabelStyle}>Paid (all time)</div>
        </Link>
      </div>

      <form action="/invoices" method="GET" style={searchFormStyle}>
        <input
          type="search"
          name="q"
          placeholder="Search by customer or invoice #"
          style={searchInputStyle}
        />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {(outstanding || []).length === 0 && (
        <p style={{ color: "#888" }}>Nothing owed right now 🎉</p>
      )}

      {(outstanding || []).slice(0, 8).map((inv) => (
        <div key={inv.invoice_id} style={cardStyle("#dc2626")}>
          <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
            {formatCurrency(inv.amount, settings.currency)} · due {inv.due_date} ·{" "}
            {inv.days_overdue > 0 ? `${inv.days_overdue} days overdue` : "not yet due"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <form action="/api/invoices/chase" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="invoiceId" value={inv.invoice_id} />
              <button type="submit" style={secondaryButtonStyle}>
                Chase now
              </button>
            </form>
            <form action="/api/invoices/mark-paid" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="invoiceId" value={inv.invoice_id} />
              <button type="submit" style={primaryButtonStyle}>
                Mark as paid
              </button>
            </form>
          </div>
        </div>
      ))}

      {(outstanding || []).length > 8 && (
        <Link href="/invoices" style={viewAllLinkStyle}>
          View all outstanding invoices →
        </Link>
      )}
    </div>
  );
}

const tabRowStyle = { display: "flex", gap: 8, marginBottom: 16 };

const tabStyle = (active) => ({
  flex: 1,
  textAlign: "center",
  padding: "10px 0",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
  background: active ? "#111" : "white",
  color: active ? "white" : "#111",
});

const statRowStyle = { display: "flex", gap: 8, margin: "4px 0 16px" };

const statBlockStyle = {
  flex: 1,
  background: "white",
  borderRadius: 10,
  padding: "12px 8px",
  textAlign: "center",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const statBlockLinkStyle = {
  ...statBlockStyle,
  textDecoration: "none",
  color: "#111",
  display: "block",
};

const statNumberStyle = { fontSize: 22, fontWeight: 700 };

const statLabelStyle = { fontSize: 11, color: "#888", marginTop: 2 };

const searchFormStyle = { display: "flex", gap: 8, marginBottom: 16 };

const searchInputStyle = {
  flex: 1,
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
};

const searchButtonStyle = {
  background: "#111",
  color: "white",
  border: "none",
  padding: "12px 16px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
};

const cardStyle = (color) => ({
  background: "white",
  borderRadius: 10,
  padding: 14,
  marginBottom: 8,
  borderLeft: `4px solid ${color}`,
});

const primaryButtonStyle = {
  width: "100%",
  background: "#111",
  color: "white",
  border: "none",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const secondaryButtonStyle = {
  width: "100%",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const declineLinkStyle = {
  background: "none",
  border: "none",
  color: "#b91c1c",
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
};

const secondaryLinkButtonStyle = {
  flex: 1,
  textAlign: "center",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};

const primaryLinkButtonStyle = {
  flex: 1,
  textAlign: "center",
  background: "#16a34a",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};

const photosLinkButtonStyle = {
  display: "block",
  textAlign: "center",
  marginTop: 8,
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};

const viewAllLinkStyle = {
  display: "block",
  textAlign: "center",
  fontSize: 13,
  color: "#666",
  textDecoration: "underline",
  marginTop: 8,
};

const accountantLinkStyle = {
  display: "block",
  textAlign: "center",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "12px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 13,
  textDecoration: "none",
  marginBottom: 16,
};
