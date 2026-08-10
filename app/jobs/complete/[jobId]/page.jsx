import { supabaseAdmin } from "../../../lib/supabaseClient";
import BackButton from "../../../components/BackButton";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompleteJob({ params, searchParams }) {
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

  const { data: photos } = await db
    .from("job_photos")
    .select("id")
    .eq("job_id", jobId);
  const hasPhotos = (photos || []).length > 0;

  // Default due date: 14 days from today, in yyyy-mm-dd for the date input
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  const defaultDueDateStr = defaultDueDate.toISOString().slice(0, 10);

  // If we're returning from an "Enhance with AI" round trip, keep whatever
  // the tradie had entered instead of resetting back to the defaults
  const amountValue = searchParams?.amount || job.amount;
  const dueDateValue = searchParams?.dueDate || defaultDueDateStr;
  const noteValue = searchParams?.note || "";
  const aiError = searchParams?.aiError === "1";

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" />
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

      <Link
        href={`/jobs/photos/${job.id}`}
        style={{
          display: "block",
          textAlign: "center",
          marginBottom: 16,
          background: "white",
          color: "#111",
          border: "1px solid #ddd",
          padding: "10px",
          borderRadius: 10,
          fontWeight: 600,
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        📷 Add / view photos
      </Link>

      {aiError && (
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
          Couldn't reach the AI just now - your note's been kept as you wrote
          it, feel free to edit it manually.
        </div>
      )}

      <form
        action="/api/jobs/complete"
        method="POST"
        style={{ display: "grid", gap: 12 }}
      >
        <input type="hidden" name="jobId" value={job.id} />
        {searchParams?.from && (
          <input type="hidden" name="from" value={searchParams.from} />
        )}

        <label style={{ fontSize: 13, color: "#666" }}>
          Final invoice amount
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0"
            defaultValue={amountValue}
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
            defaultValue={dueDateValue}
            required
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Reason for price change (optional)
          <textarea
            name="note"
            placeholder="e.g. found an extra leak while there, customer also asked for a tap swap"
            defaultValue={noteValue}
            rows={3}
            style={{ ...inputStyle, marginTop: 6, resize: "vertical" }}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            Only shown to the customer if the final amount differs from the
            quote. Jot it down rough - AI can tidy it up for you below.
          </span>
        </label>

        <button
          type="submit"
          formAction="/api/jobs/complete/enhance-note"
          style={enhanceButtonStyle}
        >
          ✨ Enhance note with AI
        </button>

        {hasPhotos && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              background: "white",
              padding: 12,
              borderRadius: 8,
            }}
          >
            <input type="checkbox" name="attachPhotos" value="1" defaultChecked />
            Include before/after photos in the invoice email
          </label>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <BackButton fallbackHref="/work?tab=jobs" style={cancelButtonStyle}>
            Cancel
          </BackButton>
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

const enhanceButtonStyle = {
  background: "white",
  color: "#111",
  padding: "12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontWeight: 600,
  fontSize: 14,
};
