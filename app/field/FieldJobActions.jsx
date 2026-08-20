"use client";

import { useRef, useState } from "react";
import { compressImage } from "../lib/compressImage";
import { queueAction } from "../lib/outbox";

// The actions available on a job from the saved day view - the dead-zone
// workspace. Each one tries the network first (so this screen is fully
// usable online too) and queues to the outbox when there's no signal.
// Every submission carries a request_id, so retries and replays can never
// double-apply (lib/idempotency.js).

async function sendOrQueue({ endpoint, label, formData, requestIdRef }) {
  if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
  formData.append("request_id", requestIdRef.current);
  try {
    const res = await fetch(endpoint, { method: "POST", body: formData });
    if (res.redirected && new URL(res.url).pathname.startsWith("/login")) {
      return { authNeeded: true };
    }
    if (!res.ok) {
      let reason = `Server said no (${res.status})`;
      try {
        const d = await res.json();
        if (d?.error) reason = d.error;
      } catch {}
      return { rejected: reason };
    }
    requestIdRef.current = null;
    return { sent: true };
  } catch {
    const ok = await queueAction({ requestId: requestIdRef.current, endpoint, label, formData }).catch(() => false);
    if (!ok) return { rejected: "Offline storage is full - get back into signal first." };
    requestIdRef.current = null;
    return { queued: true };
  }
}

export default function FieldJobActions({ job, canComplete, online, onChanged }) {
  const [openForm, setOpenForm] = useState(null); // "complete" | "note" | "photo"
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // complete
  const completeRef = useRef(null);
  const [amount, setAmount] = useState(job.amount ?? "");
  const [note, setNote] = useState("");
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);
  // note
  const noteRef = useRef(null);
  const [noteText, setNoteText] = useState("");
  const [noteImportant, setNoteImportant] = useState(false);
  async function compressAll(files) {
    const out = [];
    for (const f of files) {
      try {
        out.push(await compressImage(f, 1600, 0.8));
      } catch {
        out.push(f);
      }
    }
    return out;
  }

  function report(result, doneMsg, queuedMsg) {
    if (result.sent) setMsg(doneMsg);
    else if (result.queued) setMsg(queuedMsg);
    else if (result.authNeeded) setMsg("Your login expired - log in again to send this.");
    else setMsg(result.rejected || "Couldn't save that.");
    if (result.sent || result.queued) setOpenForm(null);
    onChanged?.();
  }

  async function submitComplete(e) {
    e.preventDefault();
    // Same guard as the main complete screen: this is the one irreversible,
    // customer-facing action (the invoice email can't be unsent). The field
    // view keeps it to a native confirm - it must work offline and stay
    // lightweight, but the number still gets shown so a wrong one jumps out.
    const fmtMoney = (n) =>
      `£${Number(n).toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    // Untouched -> the stored (VAT-inclusive) total; typed -> their figure,
    // labelled as entered because this device doesn't know the business's
    // VAT entry mode (the server applies it).
    const amountLine =
      amount === ""
        ? job.amount !== undefined && job.amount !== null
          ? `Invoice total: ${fmtMoney(job.amount)}\n`
          : ""
        : `Amount entered: ${fmtMoney(amount)}\n`;
    const ok = window.confirm(
      `Finish this job for ${job.customer?.name || "the customer"}?\n${amountLine}` +
        `The invoice goes to the customer and can't be unsent.`
    );
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("jobId", job.id);
    // Only send an amount the user actually TYPED. Sending the stored
    // amount back when untouched double-applied VAT for businesses in
    // before-VAT entry mode: the stored figure is already the gross, but
    // the server treats a submitted amount as typed (and grosses it up).
    // With no amount sent, the server falls back to the stored quote.
    if (amount !== "") fd.append("amount", String(amount));
    fd.append("note", note);
    fd.append("from", "");
    for (const f of await compressAll(beforeFiles)) fd.append("beforePhotos", f, f.name || "before.jpg");
    for (const f of await compressAll(afterFiles)) fd.append("afterPhotos", f, f.name || "after.jpg");
    const r = await sendOrQueue({
      endpoint: "/api/jobs/complete",
      label: `Complete job${job.customer?.name ? ` — ${job.customer.name}` : ""}`,
      formData: fd,
      requestIdRef: completeRef,
    });
    report(
      r,
      "Job completed — invoice sent to the customer.",
      "Saved on this phone — completes and invoices when you're back in signal."
    );
    setBusy(false);
  }

  async function submitNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("jobId", job.id);
    fd.append("note", noteText.trim());
    if (noteImportant) fd.append("important", "1");
    const r = await sendOrQueue({
      endpoint: "/api/jobs/notes/create",
      label: "Job note",
      formData: fd,
      requestIdRef: noteRef,
    });
    if (r.sent || r.queued) {
      setNoteText("");
      setNoteImportant(false);
    }
    report(r, "Note added.", "Note saved on this phone — sends when you're back in signal.");
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canComplete && (
          <button onClick={() => setOpenForm(openForm === "complete" ? null : "complete")} style={btn(openForm === "complete")}>
            Complete job
          </button>
        )}
        <button onClick={() => setOpenForm(openForm === "note" ? null : "note")} style={btn(openForm === "note")}>
          Add note
        </button>
        {online && (
          <a href={`/jobs/view/${job.id}`} style={{ ...btn(false), textDecoration: "none", display: "inline-block" }}>
            Full job ↗
          </a>
        )}
      </div>

      {msg && <div style={msgStyle}>{msg}</div>}

      {openForm === "complete" && (
        <form onSubmit={submitComplete} style={formStyle}>
          <label style={lbl}>
            Final amount (£)
            <input type="number" step="0.01" value={amount ?? ""} onChange={(e) => setAmount(e.target.value)} style={inp} />
          </label>
          <label style={lbl}>
            Completion note (goes on the invoice)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={inp} />
          </label>
          <label style={lbl}>
            Before photos
            <input type="file" accept="image/*" multiple onChange={(e) => setBeforeFiles([...e.target.files])} style={{ fontSize: 13 }} />
          </label>
          <label style={lbl}>
            After photos
            <input type="file" accept="image/*" multiple onChange={(e) => setAfterFiles([...e.target.files])} style={{ fontSize: 13 }} />
          </label>
          <button type="submit" disabled={busy} style={primary}>
            {busy ? "Saving…" : online ? "Complete + send invoice" : "Complete (sends when back in signal)"}
          </button>
        </form>
      )}

      {openForm === "note" && (
        <form onSubmit={submitNote} style={formStyle}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="What do the team need to know?"
            style={inp}
          />
          <label style={{ ...lbl, flexDirection: "row", alignItems: "center", gap: 8, display: "flex" }}>
            <input type="checkbox" checked={noteImportant} onChange={(e) => setNoteImportant(e.target.checked)} />
            Important
          </label>
          <button type="submit" disabled={busy || !noteText.trim()} style={primary}>
            {busy ? "Saving…" : "Save note"}
          </button>
        </form>
      )}

    </div>
  );
}

const btn = (active) => ({
  background: active ? "#111" : "white",
  color: active ? "white" : "#111",
  border: "1px solid #ddd",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
});
const formStyle = { display: "grid", gap: 8, marginTop: 10 };
const lbl = { display: "grid", gap: 4, fontSize: 12, color: "#555" };
const inp = { padding: "9px 10px", border: "1px solid #ddd", borderRadius: 5, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const primary = { background: "#111", color: "white", border: "none", borderRadius: 6, padding: "11px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const msgStyle = { background: "#111", color: "white", borderRadius: 6, padding: "9px 11px", fontSize: 12.5, marginTop: 8 };
