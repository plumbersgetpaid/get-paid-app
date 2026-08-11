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

  const { data: importantNotes } = await db
    .from("job_notes")
    .select("*")
    .eq("job_id", jobId)
    .eq("important", true)
    .order("created_at", { ascending: false });

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

      {(importantNotes || []).length > 0 && (
        <section style={importantNotesBannerStyle}>
          <div style={{ fontWeight: 700, color: "#92400e", fontSize: 13, marginBottom: 8 }}>
            ⚠️ Important notes for this job
          </div>
          {importantNotes.map((n) => (
            <div key={n.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, color: "#92400e", whiteSpace: "pre-wrap" }}>
                {n.note}
              </div>
              {n.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.image_url} alt="" style={importantNoteImageStyle} />
              )}
            </div>
          ))}
          <Link href={`/jobs/notes/${job.id}`} style={importantNotesLinkStyle}>
            View all notes →
          </Link>
        </section>
      )}

      <Link href={`/jobs/notes/${job.id}`} style={notesButtonStyle}>
        📝 Job notes (team only)
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
        encType="multipart/form-data"
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

        <div style={photosCardStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            Before / after photos (optional)
          </div>
          <label style={{ fontSize: 12, color: "#666" }}>
            Before
            <input
              type="file"
              name="beforePhotos"
              accept="image/*"
              multiple
              style={{ display: "block", fontSize: 13, marginTop: 4, marginBottom: 10 }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#666" }}>
            After
            <input
              type="file"
              name="afterPhotos"
              accept="image/*"
              multiple
              style={{ display: "block", fontSize: 13, marginTop: 4 }}
            />
          </label>
          <span style={{ fontSize: 11, color: "#888", display: "block", marginTop: 10 }}>
            Anything selected here becomes a permanent part of this invoice's
            PDF - you'll be able to find them again anytime you reopen or
            redownload it, not just in this one email.
          </span>
        </div>

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

const importantNotesBannerStyle = {
  background: "#fef3c7",
  border: "1px solid #fde68a",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const importantNoteImageStyle = {
  width: "100%",
  maxWidth: 200,
  borderRadius: 8,
  marginTop: 6,
  display: "block",
};

const importantNotesLinkStyle = {
  display: "block",
  fontSize: 12,
  color: "#92400e",
  fontWeight: 600,
  textDecoration: "underline",
  marginTop: 4,
};

const notesButtonStyle = {
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
};

const photosCardStyle = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 14,
};
