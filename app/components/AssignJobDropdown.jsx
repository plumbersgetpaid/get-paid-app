"use client";

import { useState } from "react";

export default function AssignJobDropdown({ jobId, assignedTo, teamMembers }) {
  const [value, setValue] = useState(assignedTo || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleChange(e) {
    const newValue = e.target.value;
    setValue(newValue);
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/jobs/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, assignedTo: newValue || null }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't update assignment");
        setValue(assignedTo || "");
      }
    } catch (err) {
      console.error("Assign job error:", err);
      setError("Couldn't reach the server");
      setValue(assignedTo || "");
    }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <select
        value={value}
        onChange={handleChange}
        disabled={busy}
        style={selectStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">Unassigned</option>
        {teamMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
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
