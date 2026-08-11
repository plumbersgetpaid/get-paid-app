"use client";

import { useState } from "react";
import Link from "next/link";
import BackButton from "../../../components/BackButton";
import { compressImage } from "../../../lib/compressImage";

export default function CompleteJobForm({
  job,
  customer,
  importantNotes,
  amountValue,
  dueDateValue,
  noteValue,
  aiError,
  from,
}) {
  const [amount, setAmount] = useState(amountValue);
  const [dueDate, setDueDate] = useState(dueDateValue);
  const [note, setNote] = useState(noteValue);
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState(null);

  async function compressAll(files) {
    const compressed = [];
    for (const file of files) {
      try {
        compressed.push(await compressImage(file));
      } catch (e) {
        console.error("Photo compression failed, using original:", e);
        compressed.push(file);
      }
    }
    return compressed;
  }

  async function handleMarkDone(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setBusyLabel(
      beforeFiles.length + afterFiles.length > 0 ? "Preparing photos..." : "Saving..."
    );

    try {
      const compressedBefore = await compressAll(beforeFiles);
      const compressedAfter = await compressAll(afterFiles);

      setBusyLabel("Saving...");

      const formData = new FormData();
      formData.append("jobId", job.id);
      formData.append("amount", amount);
      formData.append("dueDate", dueDate);
      formData.append("note", note);
      formData.append("from", from || "");
      for (const f of compressedBefore) formData.append("beforePhotos", f);
      for (const f of compressedAfter) formData.append("afterPhotos", f);

      const res = await fetch("/api/jobs/complete", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong saving this.");
        setBusy(false);
        return;
      }

      window.location.href = res.url;
    } catch (err) {
      console.error("Mark done error:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function handleEnhanceNote(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setBusyLabel("Tidying up your note...");

    try {
      const formData = new FormData();
      formData.append("jobId", job.id);
      formData.append("amount", amount);
      formData.append("dueDate", dueDate);
      formData.append("note", note);

      const res = await fetch("/api/jobs/complete/enhance-note", {
        method: "POST",
        body: formData,
      });

      window.location.href = res.url;
    } catch (err) {
      console.error("Enhance note error:", err);
      setError("Couldn't reach the AI just now - your note's been kept as you wrote it.");
      setBusy(false);
    }
  }

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

      {importantNotes.length > 0 && (
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
        <div style={aiErrorBoxStyle}>
          Couldn't reach the AI just now - your note's been kept as you wrote
          it, feel free to edit it manually.
        </div>
      )}

      {error && <div style={aiErrorBoxStyle}>{error}</div>}

      <form onSubmit={handleMarkDone} style={{ display: "grid", gap: 12 }}>
        <label style={{ fontSize: 13, color: "#666" }}>
          Final invoice amount
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Reason for price change (optional)
          <textarea
            placeholder="e.g. found an extra leak while there, customer also asked for a tap swap"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{ ...inputStyle, marginTop: 6, resize: "vertical" }}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            Only shown to the customer if the final amount differs from the
            quote. Jot it down rough - AI can tidy it up for you below.
          </span>
        </label>

        <button
          type="button"
          onClick={handleEnhanceNote}
          disabled={busy}
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
              accept="image/*"
              multiple
              onChange={(e) => setBeforeFiles(Array.from(e.target.files || []))}
              style={{ display: "block", fontSize: 13, marginTop: 4, marginBottom: 10 }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#666" }}>
            After
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setAfterFiles(Array.from(e.target.files || []))}
              style={{ display: "block", fontSize: 13, marginTop: 4 }}
            />
          </label>
          <span style={{ fontSize: 11, color: "#888", display: "block", marginTop: 10 }}>
            Anything selected here becomes a permanent part of this invoice's
            PDF - you'll be able to find them again anytime you reopen or
            redownload it, not just in this one email. Photos are shrunk down
            automatically before uploading, so there's no size limit to worry
            about.
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <BackButton fallbackHref="/work?tab=jobs" style={cancelButtonStyle}>
            Cancel
          </BackButton>
          <button type="submit" disabled={busy} style={submitButtonStyle}>
            {busy ? busyLabel : "Mark done & send invoice"}
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

const aiErrorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 13,
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
