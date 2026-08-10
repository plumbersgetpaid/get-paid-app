import { supabaseAdmin } from "./lib/supabaseClient";
import { getBusinessSettings } from "./lib/getBusinessSettings";
import { formatCurrency } from "./lib/formatCurrency";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Dashboard() {
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();

  const { data: outstanding, error: outstandingError } = await db
    .from("outstanding_invoices")
    .select("*")
    .order("due_date", { ascending: true });

  const { data: rawQuotes, error: quotesError } = await db
    .from("jobs")
    .select("*")
    .eq("status", "quote_sent")
    .order("quote_sent_at", { ascending: true });

  let quotes = rawQuotes || [];

  if (quotes.length > 0) {
    const customerIds = [...new Set(quotes.map((j) => j.customer_id))];
    const { data: customers } = await db
      .from("customers")
      .select("id, name")
      .in("id", customerIds);

    const nameById = Object.fromEntries(
      (customers || []).map((c) => [c.id, c.name])
    );

    quotes = quotes.map((j) => ({
      ...j,
      customer_name: nameById[j.customer_id] || "Unknown customer",
    }));
  }

  const { data: rawJobs, error: jobsError } = await db
    .from("jobs")
    .select("*")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });

  let jobs = rawJobs || [];

  // Fetch customer names separately (avoids relying on Supabase auto-detecting
  // the foreign key relationship, which can silently fail on new projects)
  if (jobs.length > 0) {
    const customerIds = [...new Set(jobs.map((j) => j.customer_id))];
    const { data: customers } = await db
      .from("customers")
      .select("id, name")
      .in("id", customerIds);

    const nameById = Object.fromEntries(
      (customers || []).map((c) => [c.id, c.name])
    );

    jobs = jobs.map((j) => ({
      ...j,
      customers: { name: nameById[j.customer_id] || "Unknown customer" },
    }));
  }

  const jobIds = jobs.map((j) => j.id);
  const { data: photoRows } = jobIds.length
    ? await db.from("job_photos").select("job_id").in("job_id", jobIds)
    : { data: [] };
  const photoCountByJob = {};
  for (const p of photoRows || []) {
    photoCountByJob[p.job_id] = (photoCountByJob[p.job_id] || 0) + 1;
  }

  const { data: rawPaid, error: paidError } = await db
    .from("invoices")
    .select("*")
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(20);

  let paidInvoices = rawPaid || [];

  // Attach job + customer details the same way as above - separate lookups
  // rather than relying on Supabase's auto-embed of the relationship
  if (paidInvoices.length > 0) {
    const jobIds = [...new Set(paidInvoices.map((i) => i.job_id))];
    const { data: paidJobs } = await db
      .from("jobs")
      .select("id, job_type, customer_id")
      .in("id", jobIds);

    const jobById = Object.fromEntries(
      (paidJobs || []).map((j) => [j.id, j])
    );

    const customerIds = [
      ...new Set((paidJobs || []).map((j) => j.customer_id)),
    ];
    const { data: paidCustomers } = await db
      .from("customers")
      .select("id, name")
      .in("id", customerIds);

    const nameById = Object.fromEntries(
      (paidCustomers || []).map((c) => [c.id, c.name])
    );

    paidInvoices = paidInvoices.map((inv) => {
      const job = jobById[inv.job_id];
      return {
        ...inv,
        job_type: job?.job_type,
        customer_name: job ? nameById[job.customer_id] : "Unknown customer",
      };
    });
  }

  if (jobsError || outstandingError || quotesError) {
    console.error(
      "Dashboard query error:",
      jobsError || outstandingError || quotesError
    );
  }
  if (paidError) {
    console.error("Paid invoices query error:", paidError);
  }

  const totalOwed = (outstanding || []).reduce(
    (sum, i) => sum + Number(i.amount),
    0
  );
  const overdueCount = (outstanding || []).filter((i) => i.days_overdue > 0).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const jobsTodayCount = jobs.filter(
    (j) => j.scheduled_start && j.scheduled_start.slice(0, 10) === todayStr
  ).length;
  const needsBookingCount = jobs.filter((j) => !j.scheduled_start).length;

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Get Paid</h1>
        <div style={{ display: "flex", gap: 14 }}>
          <Link href="/calendar" style={settingsLinkStyle}>
            Calendar
          </Link>
          <Link href="/clients" style={settingsLinkStyle}>
            Clients
          </Link>
          <Link href="/settings" style={settingsLinkStyle}>
            Settings
          </Link>
        </div>
      </div>

      {(jobsError || outstandingError) && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          Something went wrong loading your data:{" "}
          {(jobsError || outstandingError)?.message}
        </div>
      )}

      <section style={glanceCardStyle}>
        {quotes.length > 0 && (
          <a href="#quotes" style={glanceRowStyle}>
            <span>📝 {quotes.length} quote{quotes.length === 1 ? "" : "s"} awaiting response</span>
            <span style={glanceChevronStyle}>›</span>
          </a>
        )}
        {jobsTodayCount > 0 && (
          <a href="#jobs" style={glanceRowStyle}>
            <span>🔧 {jobsTodayCount} job{jobsTodayCount === 1 ? "" : "s"} today</span>
            <span style={glanceChevronStyle}>›</span>
          </a>
        )}
        {needsBookingCount > 0 && (
          <a href="#jobs" style={glanceRowStyle}>
            <span>
              📅 {needsBookingCount} job{needsBookingCount === 1 ? "" : "s"} need
              {needsBookingCount === 1 ? "s" : ""} booking in
            </span>
            <span style={glanceChevronStyle}>›</span>
          </a>
        )}
        <a href="#invoices" style={{ ...glanceRowStyle, borderBottom: "none" }}>
          <span>
            💰 {formatCurrency(totalOwed, settings.currency)} awaiting payment
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
          </span>
          <span style={glanceChevronStyle}>›</span>
        </a>
        {quotes.length === 0 &&
          jobsTodayCount === 0 &&
          needsBookingCount === 0 &&
          totalOwed === 0 && (
            <div style={{ padding: "10px 4px", color: "#888", fontSize: 14 }}>
              All caught up 🎉
            </div>
          )}
      </section>

      <Link
        href="/jobs/new"
        style={{
          display: "block",
          textAlign: "center",
          background: "#111",
          color: "white",
          padding: "14px",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
          marginBottom: 20,
        }}
      >
        + New quote
      </Link>

      <h2 id="quotes" style={sectionHeadingStyle("#f59e0b")}>
        Quotes awaiting response {quotes.length > 0 ? `(${quotes.length})` : ""}
      </h2>
      {quotes.length === 0 && (
        <p style={{ color: "#888" }}>No quotes waiting on a reply.</p>
      )}
      {quotes.map((q) => (
        <div key={q.id} style={cardStyle("#f59e0b")}>
          <div style={{ fontWeight: 600 }}>{q.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
            {q.job_type || "Job"} · {formatCurrency(q.amount, settings.currency)}
            {q.quote_chased_at ? " · already chased" : ""}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <form
              action="/api/jobs/accept-quote"
              method="POST"
              style={{ flex: 1 }}
            >
              <input type="hidden" name="jobId" value={q.id} />
              <button type="submit" style={markPaidButtonStyle}>
                Accept quote
              </button>
            </form>
            <form
              action="/api/jobs/chase-quote"
              method="POST"
              style={{ flex: 1 }}
            >
              <input type="hidden" name="jobId" value={q.id} />
              <button type="submit" style={chaseButtonStyle}>
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 24 }}>
        <h2 id="jobs" style={{ ...sectionHeadingStyle("#2563eb"), marginTop: 0 }}>
          Jobs in progress {jobs.length > 0 ? `(${jobs.length})` : ""}
        </h2>
        <Link href="/jobs" style={{ fontSize: 12, color: "#666", textDecoration: "underline" }}>
          All jobs →
        </Link>
      </div>
      {(jobs || []).length === 0 && (
        <p style={{ color: "#888" }}>No jobs in progress.</p>
      )}
      {(jobs || []).map((job) => (
        <div key={job.id} style={cardStyle("#2563eb")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{job.customers?.name}</div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {job.job_type} · {formatCurrency(job.amount, settings.currency)}
              </div>
              {job.location && (
                <div style={{ fontSize: 12, color: "#666" }}>📍 {job.location}</div>
              )}
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
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Link
              href={`/jobs/schedule/${job.id}`}
              style={{
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
              }}
            >
              {job.scheduled_start ? "Reschedule" : "Book in"}
            </Link>
            <Link
              href={`/jobs/complete/${job.id}`}
              style={{
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
              }}
            >
              Mark done
            </Link>
          </div>
          <Link
            href={`/jobs/photos/${job.id}`}
            style={{
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
            }}
          >
            📷 Photos{photoCountByJob[job.id] ? ` (${photoCountByJob[job.id]})` : ""}
          </Link>
        </div>
      ))}

      <h2 id="invoices" style={sectionHeadingStyle("#dc2626")}>
        Outstanding invoices {(outstanding || []).length > 0 ? `(${outstanding.length})` : ""}
      </h2>
      {(outstanding || []).length === 0 && (
        <p style={{ color: "#888" }}>Nothing owed right now 🎉</p>
      )}
      {(outstanding || []).map((inv) => (
        <div key={inv.invoice_id} style={cardStyle("#dc2626")}>
          <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
            {formatCurrency(inv.amount, settings.currency)} · due {inv.due_date} ·{" "}
            {inv.days_overdue > 0
              ? `${inv.days_overdue} days overdue`
              : "not yet due"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <form action="/api/invoices/chase" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="invoiceId" value={inv.invoice_id} />
              <button type="submit" style={chaseButtonStyle}>
                Chase now
              </button>
            </form>
            <form
              action="/api/invoices/mark-paid"
              method="POST"
              style={{ flex: 1 }}
            >
              <input type="hidden" name="invoiceId" value={inv.invoice_id} />
              <button type="submit" style={markPaidButtonStyle}>
                Mark as paid
              </button>
            </form>
          </div>
        </div>
      ))}

      <details style={{ marginTop: 24 }}>
        <summary
          style={{
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            color: "#666",
          }}
        >
          Recently paid {paidInvoices.length > 0 ? `(${paidInvoices.length})` : ""}
        </summary>
        <div style={{ marginTop: 12 }}>
          {paidInvoices.length === 0 && (
            <p style={{ color: "#888" }}>No paid invoices yet.</p>
          )}
          {paidInvoices.map((inv) => (
            <div key={inv.id} style={{ ...cardStyle("#9ca3af"), opacity: 0.85 }}>
              <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {formatCurrency(inv.amount, settings.currency)} · {inv.job_type || "Job"} · paid{" "}
                {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-GB") : ""}
              </div>
            </div>
          ))}
        </div>
      </details>

      <Link
        href="/invoices"
        style={{
          display: "block",
          textAlign: "center",
          fontSize: 13,
          color: "#666",
          marginTop: 24,
          textDecoration: "underline",
        }}
      >
        View all invoices (for your accountant) →
      </Link>
    </main>
  );
}

const cardStyle = (color) => ({
  background: "white",
  borderRadius: 10,
  padding: 14,
  marginBottom: 8,
  borderLeft: `4px solid ${color}`,
});

const sectionHeadingStyle = (color) => ({
  fontSize: 16,
  marginTop: 24,
  paddingLeft: 10,
  borderLeft: `4px solid ${color}`,
});

const glanceCardStyle = {
  background: "white",
  borderRadius: 12,
  padding: "4px 16px",
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const glanceRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 4px",
  borderBottom: "1px solid #f0f0f0",
  textDecoration: "none",
  color: "#111",
  fontSize: 15,
  fontWeight: 600,
};

const glanceChevronStyle = {
  color: "#ccc",
  fontSize: 18,
};

const chaseButtonStyle = {
  width: "100%",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const markPaidButtonStyle = {
  width: "100%",
  background: "#111",
  color: "white",
  border: "none",
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

const settingsLinkStyle = {
  fontSize: 13,
  color: "#666",
  textDecoration: "underline",
};
