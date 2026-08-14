"use client";

import { useState } from "react";

export default function ShareJobControl({ jobId, initialShares, teamMembers }) {
  const [shares, setShares] = useState(initialShares);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const shareableMembers = teamMembers.filter(
    (m) => !shares.some((s) => s.id === m.id)
  );

  async function handleAdd(e) {
    const teamMemberId = e.target.value;
    if (!teamMemberId) return;
    e.target.value = "";

    const member = teamMembers.find((m) => m.id === teamMemberId);
    setError(null);
    setBusy(true);

    try {
      const form = new FormData();
      form.append("jobId", jobId);
      form.append("teamMemberId", teamMemberId);
      const res = await fetch("/api/jobs/share", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't share this job");
      } else if (member) {
        setShares((prev) => [...prev, member]);
      }
    } catch (err) {
      console.error("Share job error:", err);
      setError("Couldn't reach the server");
    }
    setBusy(false);
  }

  async function handleRemove(teamMemberId) {
    setError(null);
    setBusy(true);
    const previous = shares;
    setShares((prev) => prev.filter((s) => s.id !== teamMemberId));

    try {
      const form = new FormData();
      form.append("jobId", jobId);
      form.append("teamMemberId", teamMemberId);
      const res = await fetch("/api/jobs/unshare", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        setShares(previous);
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't remove that share");
      }
    } catch (err) {
      console.error("Unshare job error:", err);
      setShares(previous);
      setError("Couldn't reach the server");
    }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
      {shares.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {shares.map((s) => (
            <span key={s.id} style={shareTagStyle}>
              {s.name}
              <button
                type="button"
                onClick={() => handleRemove(s.id)}
                disabled={busy}
                style={removeTagButtonStyle}
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {shareableMembers.length > 0 && (
        <select value="" onChange={handleAdd} disabled={busy} style={selectStyle}>
          <option value="">+ Share with...</option>
          {shareableMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{error}</div>}
    </div>
  );
}

const selectStyle = {
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid #ddd",
  color: "#111",
  background: "white",
};

const shareTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  background: "#eef2ff",
  color: "#3730a3",
  padding: "3px 6px 3px 10px",
  borderRadius: 999,
};

const removeTagButtonStyle = {
  background: "none",
  border: "none",
  color: "#3730a3",
  fontSize: 14,
  lineHeight: 1,
  padding: "0 2px",
  cursor: "pointer",
  fontWeight: 700,
};
