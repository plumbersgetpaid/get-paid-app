"use client";

import { useRef, useState } from "react";
import { queueAction } from "../../../lib/outbox";
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
  showEverything,
}) {
  const requestIdRef = useRef(null);
  const [queued, setQueued] = useState(false);
  const [amount, setAmount] = useState(amountValue);
  const [dueDate, setDueDate] = useState(dueDateValue);
  const [note, setNote] = useState(noteValue);
  const [paymentLink, setPaymentLink] = useState("");
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState(null);

  // Adds to whatever's already selected rather than replacing it - the
  // native file picker's own onChange always reports only the files
  // chosen in that one interaction, so replacing here would silently
  // drop anything picked in an earlier pass. Clearing the input's own
  // value afterward means this array is the only place selection state
  // actually lives, so a later tap on the same input always starts from
  // a clean, empty picker rather than the browser's own memory of what
  // was previously chosen.
  function handleAddBeforeFiles(e) {
    const newFiles = Array.from(e.target.files || []);
    setBeforeFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  }

  function handleAddAfterFiles(e) {
    const newFiles = Array.from(e.target.files || []);
    setAfterFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  }

  function handleRemoveBeforeFile(index) {
    setBeforeFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRemoveAfterFile(index) {
    setAfterFiles((prev) => prev.filter((_, i) => i !== index));
  }

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

      setBusyLabel("Sending invoice...");

      const formData = new FormData();
      formData.append("jobId", job.id);
      // A subcontractor never sends amount/dueDate/paymentLink at all -
      // not just hidden fields with default values, genuinely absent
      // from the request. The server also independently ignores these
      // for anyone who isn't owner/manager, so this isn't the only
      // thing stopping a crafted request either.
      if (showEverything) {
        formData.append("amount", amount);
        formData.append("dueDate", dueDate);
        formData.append("paymentLink", paymentLink);
      }
      formData.append("note", note);
      formData.append("from", from || "");
      for (const f of compressedBefore) formData.append("beforePhotos", f);
      for (const f of compressedAfter) formData.append("afterPhotos", f);

      // Same id across retries of this submission, so a flaky connection
      // can't complete the job (and invoice the customer) twice.
      if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
      formData.append("request_id", requestIdRef.current);

      let res;
      try {
        res = await fetch("/api/jobs/complete", { method: "POST", body: formData });
      } catch (netErr) {
        // No signal. Keep the whole completion - photos included - on the
        // phone and replay it automatically when the connection returns.
        const ok = await queueAction({
          requestId: requestIdRef.current,
          endpoint: "/api/jobs/complete",
          label: `Complete job${customer?.name ? ` — ${customer.name}` : ""}`,
          formData,
        });
        if (!ok) {
          setError("This phone's offline storage is full - connect to signal to send your saved work first.");
          setBusy(false);
          return;
        }
        setQueued(true);
        setBusy(false);
        return;
      }

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
      formData.append("note", note);

      const res = await fetch("/api/jobs/complete/enhance-note", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      // Update the note text in place - no navigation, no reload, so any
      // photos already selected stay exactly where they are
      if (data.note) setNote(data.note);
      if (data.error) setError(data.error + " - your note's been kept as you wrote it.");
      setBusy(false);
    } catch (err) {
      console.error("Enhance note error:", err);
      setError("Couldn't reach the AI just now - your note's been kept as you wrote it.");
      setBusy(false);
    }
  }


  if (queued) {
    return (
      <div style={{ background: "#111", color: "white", borderRadius: 8, padding: 18, marginTop: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Saved on this phone ✓</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.85, margin: "8px 0 0" }}>
          No signal right now, so this job completion - photos and all - is
          stored safely on this phone. The moment you're back in signal it
          sends itself: the job completes and the invoice goes to the
          customer. Nothing else to do.
        </p>
        <a href="/field" style={{ color: "white", fontSize: 13.5, display: "inline-block", marginTop: 12 }}>
          See your saved day →
        </a>
      </div>
    );
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Complete job</h1>
      </div>

      <section
        style={{
          background: "white",
          borderRadius: 3,
          padding: 16,
          margin: "16px 0",
          border: "1px solid #e2e2e2",
        }}
      >
        <div style={{ fontWeight: 500 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {job.job_type || "Job"}
          {showEverything && <> · originally quoted £{job.amount}</>}
        </div>
        {!customer?.email && (
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>
            No email on file — invoice will be created but not emailed.
          </div>
        )}
      </section>

      {importantNotes.length > 0 && (
        <section style={importantNotesBannerStyle}>
          <div style={{ fontWeight: 500, color: "#92400e", fontSize: 13, marginBottom: 8 }}>
            Important notes for this job
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
          <a href={`/jobs/notes/${job.id}`} style={importantNotesLinkStyle}>
            View all notes →
          </a>
        </section>
      )}

      <a href={`/jobs/notes/${job.id}`} style={notesButtonStyle}>
        Job notes (team only)
      </a>

      {aiError && (
        <div style={aiErrorBoxStyle}>
          Couldn't reach the AI just now - your note's been kept as you wrote
          it, feel free to edit it manually.
        </div>
      )}

      {error && <div style={aiErrorBoxStyle}>{error}</div>}

      <form onSubmit={handleMarkDone} style={{ display: "grid", gap: 12 }}>
        {showEverything && (
          <>
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
              Payment link (optional)
              <input
                type="url"
                placeholder="https://... - e.g. a Stripe or GoCardless link for this amount"
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                style={{ ...inputStyle, marginTop: 6 }}
              />
              <span style={{ fontSize: 12, color: "#888" }}>
                Adds a "Pay now" button to the invoice, alongside your bank
                details - the customer can use either. Leave blank for bank
                details only, same as always.
              </span>
            </label>
          </>
        )}

        <label style={{ fontSize: 13, color: "#666" }}>
          {showEverything ? "Reason for price change (optional)" : "Completion note (optional)"}
          <textarea
            placeholder={
              showEverything
                ? "e.g. found an extra leak while there, customer also asked for a tap swap"
                : "e.g. anything worth noting about how the job went"
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{ ...inputStyle, marginTop: 6, resize: "vertical" }}
          />
          {showEverything && (
            <span style={{ fontSize: 12, color: "#888" }}>
              Only shown to the customer if the final amount differs from the
              quote. Jot it down rough - AI can tidy it up for you below.
            </span>
          )}
        </label>

        <button
          type="button"
          onClick={handleEnhanceNote}
          disabled={busy}
          style={enhanceButtonStyle}
        >
          Enhance note with AI
        </button>

        <div style={photosCardStyle}>
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>
            Before / after photos (optional)
          </div>
          <label style={{ fontSize: 12, color: "#666" }}>
            Before
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddBeforeFiles}
              style={{ display: "block", fontSize: 13, marginTop: 4 }}
            />
          </label>
          {beforeFiles.length > 0 && (
            <div style={fileListStyle}>
              {beforeFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} style={fileRowStyle}>
                  <span style={fileNameStyle}>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBeforeFile(i)}
                    style={removeFileButtonStyle}
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <label style={{ fontSize: 12, color: "#666", marginTop: 14, display: "block" }}>
            After
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddAfterFiles}
              style={{ display: "block", fontSize: 13, marginTop: 4 }}
            />
          </label>
          {afterFiles.length > 0 && (
            <div style={fileListStyle}>
              {afterFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} style={fileRowStyle}>
                  <span style={fileNameStyle}>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAfterFile(i)}
                    style={removeFileButtonStyle}
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

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
            {busy ? busyLabel : showEverything ? "Mark done & send invoice" : "Mark done"}
          </button>
        </div>
      </form>
    </main>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

const cancelButtonStyle = {
  background: "white",
  color: "#000",
  padding: "14px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontWeight: 500,
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
};

const submitButtonStyle = {
  background: "#16a34a",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  flex: 2,
};

const enhanceButtonStyle = {
  background: "white",
  color: "#000",
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontWeight: 500,
  fontSize: 14,
};

const aiErrorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 2,
  marginBottom: 12,
  fontSize: 13,
};

const importantNotesBannerStyle = {
  background: "#fef3c7",
  border: "1px solid #fde68a",
  borderRadius: 3,
  padding: 16,
  marginBottom: 16,
};

const importantNoteImageStyle = {
  width: "100%",
  maxWidth: 200,
  borderRadius: 2,
  marginTop: 6,
  display: "block",
};

const importantNotesLinkStyle = {
  display: "block",
  fontSize: 12,
  color: "#92400e",
  fontWeight: 500,
  textDecoration: "underline",
  marginTop: 4,
};

const notesButtonStyle = {
  display: "block",
  textAlign: "center",
  marginBottom: 16,
  background: "white",
  color: "#000",
  border: "1px solid #e2e2e2",
  padding: "10px",
  borderRadius: 2,
  fontWeight: 500,
  textDecoration: "none",
  fontSize: 14,
};

const photosCardStyle = {
  background: "white",
  border: "1px solid #e2e2e2",
  borderRadius: 2,
  padding: 14,
};

const fileListStyle = {
  marginTop: 6,
  display: "grid",
  gap: 4,
};

const fileRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  background: "#f6f7f9",
  borderRadius: 2,
  padding: "6px 8px",
};

const fileNameStyle = {
  fontSize: 12,
  color: "#444",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const removeFileButtonStyle = {
  background: "none",
  border: "none",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  padding: "2px 6px",
  flexShrink: 0,
};
