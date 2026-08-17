"use client";

import { useState } from "react";
import Icon from "./Icon";
import { useRouter } from "next/navigation";

export default function AssignAndShareControl({ jobId, initialAssignees, teamMembers }) {
  const router = useRouter();
  const [assignees, setAssignees] = useState(initialAssignees);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const assignedIds = new Set(assignees.map((a) => a.id));

  async function handleToggle(member) {
    const isCurrentlyAssigned = assignedIds.has(member.id);
    setError(null);
    setBusy(true);

    const previous = assignees;
    setAssignees((prev) =>
      isCurrentlyAssigned ? prev.filter((a) => a.id !== member.id) : [...prev, member]
    );

    try {
      const form = new FormData();
      form.append("jobId", jobId);
      form.append("teamMemberId", member.id);
      const res = await fetch(isCurrentlyAssigned ? "/api/jobs/unshare" : "/api/jobs/share", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        setAssignees(previous);
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't update that");
      } else {
        // Tells Next.js's own page cache this route's data just changed,
        // so navigating back to it later re-fetches fresh rather than
        // serving a snapshot from before this change - same fix already
        // proven on the team permissions screen
        router.refresh();
      }
    } catch (err) {
      console.error("Update assignment error:", err);
      setAssignees(previous);
      setError("Couldn't reach the server");
    }
    setBusy(false);
  }

  return (
    <details style={{ marginTop: 8 }}>
      <summary style={summaryStyle}>
        <Icon name="person" size={15} strokeWidth={1.6} />
        {assignees.length === 0 ? "Unassigned" : assignees.map((a) => a.name).join(", ")}
      </summary>
      <div style={optionsBoxStyle}>
        {teamMembers.map((m) => (
          <label key={m.id} style={optionRowStyle}>
            <input
              type="checkbox"
              checked={assignedIds.has(m.id)}
              disabled={busy}
              onChange={() => handleToggle(m)}
            />
            {m.name}
          </label>
        ))}
        {teamMembers.length === 0 && (
          <div style={{ fontSize: 12, color: "#888" }}>No team members yet</div>
        )}
      </div>
      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{error}</div>}
    </details>
  );
}

const summaryStyle = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  color: "#000",
  background: "white",
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-block",
};

const optionsBoxStyle = {
  marginTop: 6,
  background: "white",
  border: "1px solid #e2e2e2",
  borderRadius: 2,
  padding: 6,
};

const optionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  padding: "7px 6px",
};
