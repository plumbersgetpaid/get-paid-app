"use client";

import { useState } from "react";

export default function DuplicateRow({ customerId, customerName, dupe }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [handled, setHandled] = useState(false);
  const [mergedOk, setMergedOk] = useState(false);

  async function handleMerge() {
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("keepId", customerId);
      formData.append("mergeId", dupe.id);
      const res = await fetch("/api/clients/merge", {
        method: "POST",
        body: formData,
        // If this hangs, say so clearly instead of leaving "Working..."
        // showing forever with no way to tell stuck apart from just slow
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't merge these.");
        setBusy(false);
        return;
      }

      // Show a clear success state, then remove this row entirely - no
      // page reload involved at all, so there's nothing that can fail to
      // "take effect". The rest of the page (customer name, job history)
      // doesn't need refreshing anyway - only this notice needs to go.
      setMergedOk(true);
      setTimeout(() => setHandled(true), 900);
    } catch (err) {
      console.error("Merge error:", err);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setError(
          "This is taking much longer than it should (over 15s) - your connection may be slow right now, or something's genuinely stuck. Try again in a moment."
        );
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  async function handleIgnore() {
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("customerId", customerId);
      formData.append("dupeId", dupe.id);
      const res = await fetch("/api/clients/ignore-duplicate", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't save that.");
        setBusy(false);
        return;
      }
      setHandled(true);
    } catch (err) {
      console.error("Ignore duplicate error:", err);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setError("This is taking much longer than it should - try again in a moment.");
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  if (handled) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{dupe.name}</div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
        {[dupe.phone, dupe.email].filter(Boolean).join(" · ")}
      </div>
      {mergedOk && (
        <div style={{ fontSize: 12, color: "#166534", marginBottom: 6, fontWeight: 700 }}>
          ✓ Merged
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 6 }}>{error}</div>
      )}
      <button
        type="button"
        onClick={handleMerge}
        disabled={busy || mergedOk}
        style={mergeButtonStyle}
      >
        {mergedOk ? "✓ Merged" : busy ? "Working..." : `Merge into ${customerName}`}
      </button>
      <button
        type="button"
        onClick={handleIgnore}
        disabled={busy || mergedOk}
        style={ignoreButtonStyle}
      >
        Not a duplicate - ignore
      </button>
    </div>
  );
}

const mergeButtonStyle = {
  display: "block",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const ignoreButtonStyle = {
  display: "block",
  background: "none",
  border: "none",
  color: "#666",
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  marginTop: 6,
};
