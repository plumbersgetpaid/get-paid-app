import { supabaseAdmin } from "./lib/supabaseClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Dashboard() {
  const db = supabaseAdmin();

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

      <section
        style={{
          background: "white",
          borderRadius: 12,
          padding: 16,
          margin: "16px 0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 14, color: "#666" }}>Total outstanding</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>
          £{totalOwed.toFixed(2)}
        </div>
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

      <h2 style={{ fontSize: 16 }}>Quotes awaiting response</h2>
      {quotes.length === 0 && (
        <p style={{ color: "#888" }}>No quotes waiting on a reply.</p>
      )}
      {quotes.map((q) => (
        <div
          key={q.id}
          style={{
            background: "white",
            borderRadius: 10,
            padding: 14,
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 600 }}>{q.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
            {q.job_type || "Job"} · £{q.amount}
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

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Jobs in progress</h2>
      {(jobs || []).length === 0 && (
        <p style={{ color: "#888" }}>No jobs in progress.</p>
      )}
      {(jobs || []).map((job) => (
        <div
          key={job.id}
          style={{
            background: "white",
            borderRadius: 10,
            padding: 14,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{job.customers?.name}</div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {job.job_type} · £{job.amount}
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
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Outstanding invoices</h2>
      {(outstanding || []).length === 0 && (
        <p style={{ color: "#888" }}>Nothing owed right now 🎉</p>
      )}
      {(outstanding || []).map((inv) => (
        <div
          key={inv.invoice_id}
          style={{
            background: "white",
            borderRadius: 10,
            padding: 14,
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
            £{inv.amount} · due {inv.due_date} ·{" "}
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

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Recently paid</h2>
      {paidInvoices.length === 0 && (
        <p style={{ color: "#888" }}>No paid invoices yet.</p>
      )}
      {paidInvoices.map((inv) => (
        <div
          key={inv.id}
          style={{
            background: "white",
            borderRadius: 10,
            padding: 14,
            marginBottom: 8,
            opacity: 0.85,
          }}
        >
          <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            £{inv.amount} · {inv.job_type || "Job"} · paid{" "}
            {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-GB") : ""}
          </div>
        </div>
      ))}

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
