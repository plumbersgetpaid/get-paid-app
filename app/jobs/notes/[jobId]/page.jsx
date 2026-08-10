import { supabaseAdmin } from "../../../lib/supabaseClient";
import { notFound } from "next/navigation";
import BackButton from "../../../components/BackButton";

export const dynamic = "force-dynamic";

export default async function JobNotes({ params }) {
  const { jobId } = params;
  const db = supabaseAdmin();

  const { data: job, error } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    notFound();
  }

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .eq("id", job.customer_id)
    .single();

  const { data: rawNotes } = await db
    .from("job_notes")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  // Important notes always float to the top, regardless of when they were
  // added, so nothing crucial gets buried under routine ones
  const notes = (rawNotes || []).sort((a, b) => {
    if (a.important !== b.important) return a.important ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Job notes</h1>
      </div>

      <section style={summaryCardStyle}>
        <div style={{ fontWeight: 600 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>{job.job_type || "Job"}</div>
      </section>

      <div style={internalBannerStyle}>
        🔒 Internal only - these notes are never shown or sent to the client.
      </div>

      <form
        action="/api/jobs/notes/create"
        method="POST"
        style={{ display: "grid", gap: 10, marginTop: 16 }}
      >
        <input type="hidden" name="jobId" value={job.id} />
        <textarea
          name="note"
          placeholder="e.g. Don't forget to cap off pipes left in the wall before it's tiled"
          rows={3}
          required
          style={textareaStyle}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" name="important" value="1" />
          ⚠️ Flag as important
        </label>
        <button type="submit" style={submitButtonStyle}>
          Add note
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Notes ({notes.length})</h2>
      {notes.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>No notes yet.</p>}

      {notes.map((n) => (
        <div key={n.id} style={n.important ? importantNoteCardStyle : noteCardStyle}>
          {n.important && (
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 12, marginBottom: 4 }}>
              ⚠️ Important
            </div>
          )}
          <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{n.note}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
            {new Date(n.created_at).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <form action="/api/jobs/notes/delete" method="POST" style={{ marginTop: 6 }}>
            <input type="hidden" name="noteId" value={n.id} />
            <input type="hidden" name="jobId" value={job.id} />
            <button type="submit" style={deleteNoteButtonStyle}>
              Delete
            </button>
          </form>
        </div>
      ))}
    </main>
  );
}

const summaryCardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const internalBannerStyle = {
  background: "#f3f4f6",
  color: "#444",
  padding: 10,
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
};

const textareaStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  fontFamily: "inherit",
};

const submitButtonStyle = {
  background: "#111",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  fontSize: 15,
};

const noteCardStyle = {
  background: "white",
  borderRadius: 10,
  padding: 14,
  marginBottom: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const importantNoteCardStyle = {
  ...noteCardStyle,
  background: "#fef3c7",
  border: "1px solid #fde68a",
};

const deleteNoteButtonStyle = {
  background: "none",
  border: "none",
  color: "#b91c1c",
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
};
