import { supabaseAdmin } from "../../../lib/supabaseClient";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompleteJob({ params }) {
  const { jobId } = params;
  const db = supabaseAdmin();

  const { data: job, error: jobError } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    notFound();
  }

  const { data: customer } = await db
    .from("customers")
    .select("name, email")
    .eq("id", job.customer_id)
    .single();

  // Default due date: 14 days from today, in yyyy-mm-dd for the date input
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  const defaultDueDateStr = defaultDueDate.toISOString().slice(0, 10);

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Complete job</h1>
      </div>

      <section
        style={{
          background: "white",
          borderRadius: 12,
          padding: 16,
          margin: "16px 0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontWeight: 600 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {job.job_type || "Job"} · originally quoted £{job.amount}
        </div>
        {!customer?.email && (
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>
            No email on file — invoice will be created but not emailed.
          </div>
        )}
      </section>

      <form
        action="/api/jobs/complete"
        method="POST"
        style={{ display: "grid", gap: 12 }}
      >
        <input type="hidden" name="jobId" value={job.id} />

        <label style={{ fontSize: 13, color: "#666" }}>
          Final invoice amount
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0"
            defaultValue={job.amount}
            required
            style={{ ...inputStyle, marginTop: 6 }}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            Adjust this if more or less work was done than originally quoted -
            the customer gets an invoice for this amount, not the quote.
          </span>
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Payment due date
          <input
            type="date"
            name="dueDate"
            defaultValue={defaultDueDateStr}
            required
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Mark done &amp; send invoice
          </button>
        </div>
      </form>
    </main>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

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

const cancelButtonStyle = {
  background: "white",
  color: "#111",
  padding: "14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontWeight: 600,
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
};

const submitButtonStyle = {
  background: "#16a34a",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  flex: 2,
};
