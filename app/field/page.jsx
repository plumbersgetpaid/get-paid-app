"use client";

import { useEffect, useState } from "react";
import { loadFieldPack } from "../lib/fieldPackStore";
import { listOutbox, retryOutboxEntry, removeOutboxEntry, syncOutbox } from "../lib/outbox";
import FieldJobActions from "./FieldJobActions";

// The offline day view. Rendered entirely from the field pack in
// IndexedDB - the page itself is a public, dataless shell, which is what
// lets the service worker cache it and serve it with no session check
// when there's no signal. All times are shown by slicing the stored
// wall-clock strings directly (never new Date + toLocaleTimeString on the
// device, which would shift London wall-clock by an hour during BST).

const timeOf = (iso) => (iso || "").slice(11, 16);
const dateOf = (iso) => (iso || "").slice(0, 10);

function dayLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return "Today";
  const d = new Date(`${dateStr}T12:00:00Z`);
  const label = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const tomorrow = new Date(`${todayStr}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return dateStr === tomorrow.toISOString().slice(0, 10) ? `Tomorrow — ${label}` : label;
}

export default function FieldView() {
  const [pack, setPack] = useState(undefined); // undefined = loading
  const [online, setOnline] = useState(true);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [outbox, setOutbox] = useState([]);

  const refreshOutbox = () => listOutbox().then(setOutbox).catch(() => {});

  // After an action from this screen: outbox changed and, if we were
  // online, the server did too - pull both so badges and lists are honest.
  const refreshAll = () => {
    refreshOutbox();
    if (navigator.onLine) {
      fetch("/api/field-pack")
        .then((r) => (r.ok && !r.redirected ? r.json() : null))
        .then(async (fresh) => {
          if (!fresh) return;
          const { saveFieldPack } = await import("../lib/fieldPackStore");
          await saveFieldPack(fresh);
          setPack(fresh);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    // Opened with signal: fetch the freshest pack directly, so "check my
    // day, then drive into a dead zone" always leaves with current data.
    // Any failure falls straight back to whatever the phone already holds.
    async function freshest() {
      if (navigator.onLine) {
        try {
          const res = await fetch("/api/field-pack");
          if (res.ok && !res.redirected) {
            const fresh = await res.json();
            const { saveFieldPack } = await import("../lib/fieldPackStore");
            await saveFieldPack(fresh);
            setPack(fresh);
            return;
          }
        } catch {}
      }
      loadFieldPack().then((p) => setPack(p || null)).catch(() => setPack(null));
    }
    freshest();
    refreshOutbox();
    setOnline(navigator.onLine);
    const up = () => {
      setOnline(true);
      // If the session expired, the queue is HELD (never posts another
      // user's work) - surface that instead of leaving entries silently
      // stuck on "sending…".
      syncOutbox().then((result) => {
        if (result?.authNeeded) setAuthNeeded(true);
        refreshOutbox();
      });
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (pack === undefined) {
    return <main style={pageStyle}><p style={mutedStyle}>Loading your saved day...</p></main>;
  }

  if (pack === null) {
    return (
      <main style={pageStyle}>
        <h1 style={h1Style}>Your day, offline</h1>
        <p style={mutedStyle}>
          Nothing saved on this device yet. Open PatchUp once while you have
          signal and your next 7 days will be kept here automatically.
        </p>
        <a href="/" style={linkStyle}>Go to PatchUp</a>
      </main>
    );
  }

  // Group jobs and reminders by their stored (London wall-clock) date.
  const byDay = {};
  for (const j of pack.jobs || []) (byDay[dateOf(j.start)] ||= { jobs: [], reminders: [] }).jobs.push(j);
  for (const r of pack.reminders || [])
    (byDay[dateOf(r.scheduled_start)] ||= { jobs: [], reminders: [] }).reminders.push(r);
  const days = Object.keys(byDay).sort();
  const savedAtLabel = (pack.savedAt || "").slice(0, 16).replace("T", " ");

  return (
    <main style={pageStyle}>
      {authNeeded && (
        <div style={{ background: "#fef3c7", color: "#92400e", borderRadius: 6, padding: "9px 12px", fontSize: 12.5, marginBottom: 8 }}>
          Your login expired — <a href="/login" style={{ color: "#92400e", fontWeight: 600 }}>log in again</a> to send your saved work.
        </div>
      )}
      <div style={online ? onlineBannerStyle : offlineBannerStyle}>
        {online
          ? "You're online — this is your saved copy."
          : "No connection — showing your saved day."}
        <span style={{ opacity: 0.75 }}> Saved {savedAtLabel}</span>
      </div>

      {outbox.length > 0 && (
        <section style={{ marginTop: 14 }}>
          <h2 style={h2Style}>Waiting to send ({outbox.length})</h2>
          {outbox.map((e) => (
            <div key={e.requestId} style={{ ...cardStyle, borderColor: e.status === "failed" ? "#fca5a5" : "#e2e2e2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                <span>{e.label}</span>
                <span style={{ color: e.status === "failed" ? "#b91c1c" : "#888", fontSize: 12 }}>
                  {e.status === "failed" ? "needs attention" : online ? "sending…" : "when signal returns"}
                </span>
              </div>
              {e.status === "failed" && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: "#b91c1c" }}>
                  {e.error}
                  <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
                    <button onClick={() => retryOutboxEntry(e.requestId).then(refreshOutbox)} style={tinyBtnStyle}>
                      Try again
                    </button>
                    <button onClick={() => removeOutboxEntry(e.requestId).then(refreshOutbox)} style={tinyBtnStyle}>
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <h1 style={h1Style}>{pack.businessName || "PatchUp"}</h1>
      <p style={mutedStyle}>The next 7 days, kept on this phone.</p>

      {days.length === 0 && <p style={mutedStyle}>Nothing booked in the next 7 days.</p>}

      {days.map((day) => (
        <section key={day} style={{ marginTop: 22 }}>
          <h2 style={h2Style}>{dayLabel(day, pack.from)}</h2>

          {byDay[day].jobs.map((j) => {
            const queuedDone = outbox.some(
              (e) => e.status !== "failed" && e.endpoint === "/api/jobs/complete" && e.fields?.some(([k, v]) => k === "jobId" && v === j.id)
            );
            return (
            <div key={j.id} style={{ ...cardStyle, opacity: queuedDone ? 0.75 : 1 }}>
              {queuedDone && (
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#166534", marginBottom: 6 }}>
                  ✓ COMPLETED — WAITING TO SEND
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 15 }}>
                  {j.timeConfirmed ? timeOf(j.start) : "Time TBC"}
                  {j.timeConfirmed && j.end ? `–${timeOf(j.end)}` : ""}
                </strong>
                <span style={{ fontSize: 13, color: "#666" }}>{j.jobType || "Job"}</span>
              </div>
              {j.customer && (
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  {j.customer.name}
                  {j.customer.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${j.customer.phone}`} style={linkStyle}>
                        {j.customer.phone}
                      </a>
                    </>
                  )}
                </div>
              )}
              {(j.location || j.customer?.address) && (
                <div style={{ marginTop: 4, fontSize: 13, color: "#444" }}>
                  {j.location || j.customer.address}
                </div>
              )}
              {(j.notes || []).length > 0 && (
                <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
                  {j.notes.map((n, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: n.important ? "#b45309" : "#555", marginTop: i ? 4 : 0 }}>
                      {n.important ? "★ " : ""}{n.note}
                    </div>
                  ))}
                </div>
              )}
              {!queuedDone && (
                <FieldJobActions
                  job={j}
                  canComplete={!!pack.can?.complete}
                  online={online}
                  onChanged={refreshAll}
                />
              )}
            </div>
            );
          })}

          {byDay[day].reminders.map((r) => (
            <div key={r.id} style={{ ...cardStyle, background: "#fbfbf6" }}>
              <strong style={{ fontSize: 14 }}>{timeOf(r.scheduled_start)}</strong>
              <span style={{ fontSize: 14 }}> — {r.title}</span>
              {r.notes && <div style={{ fontSize: 12.5, color: "#555", marginTop: 4 }}>{r.notes}</div>}
            </div>
          ))}
        </section>
      ))}

      <p style={{ marginTop: 28 }}>
        <a href="/" style={linkStyle}>{online ? "Back to PatchUp" : "Try PatchUp (needs signal)"}</a>
      </p>
    </main>
  );
}

const pageStyle = { maxWidth: 520, margin: "0 auto", padding: "18px 16px 60px" };
const h1Style = { fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em", margin: "14px 0 2px" };
const h2Style = { fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", margin: "0 0 8px" };
const mutedStyle = { fontSize: 13.5, color: "#888", lineHeight: 1.5 };
const cardStyle = { background: "white", border: "1px solid #e2e2e2", borderRadius: 6, padding: 12, marginBottom: 8 };
const linkStyle = { color: "#111", fontWeight: 500 };
const tinyBtnStyle = { background: "white", border: "1px solid #ddd", borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };
const offlineBannerStyle = { background: "#111", color: "white", borderRadius: 6, padding: "9px 12px", fontSize: 12.5 };
const onlineBannerStyle = { background: "#e8f5ec", color: "#166534", borderRadius: 6, padding: "9px 12px", fontSize: 12.5 };
