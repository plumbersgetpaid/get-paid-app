import { supabaseAdmin } from "./lib/supabaseClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const db = supabaseAdmin();

  const { data: outstanding, error: outstandingError } = await db
    .from("outstanding_invoices")
    .select("*")
    .order("due_date", { ascending: true });

  const { data: rawJobs, error: jobsError } = await db
    .from("jobs")
    .select("*")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });

  let jobs = rawJobs || [];

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

  if (jobsError || outstandingError) {
    console.error("Dashboard query error:", jobsError || outstandingError);
  }

  const totalOwed = (outstanding || []).reduce(
    (sum, i) => sum + Number(i.amount),
    0
  );

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>Get Paid</h1>

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
        + Add a job
      </Link>

      <h2 style={{ fontSize: 16 }}>Jobs in progress</h2>
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{job.customers?.name}</div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {job.job_type} · £{job.amount}
            </div>
          </div>
          <form action={`/api/jobs/complete`} method="POST">
            <input type="hidden" name="jobId" value={job.id} />
            <button
              type="submit"
              style={{
                background: "#16a34a",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Mark done
            </button>
          </form>
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
          <div style={{ fontSize: 13, color: "#888" }}>
            £{inv.amount} · due {inv.due_date} ·{" "}
            {inv.days_overdue > 0
              ? `${inv.days_overdue} days overdue`
              : "not yet due"}
          </div>
        </div>
      ))}
    </main>
  );
}
