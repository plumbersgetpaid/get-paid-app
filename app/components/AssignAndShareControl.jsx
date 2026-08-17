"use client";

import { useState } from "react";
import Icon from "./Icon";
import { useRouter } from "next/navigation";

export default function AssignAndShareControl({ jobId, initialAssignees, teamMembers }) {
  const router = useRouter();
  const [assignees, setAssignees] = useState(initialAssignees);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
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
    <div style={{ marginTop: 8 }}>
      {/* Was <details>/<summary>: the browser marker sat on its own
          line and the icon dropped below it, turning a one-line field
          into a three-line block. */}
      <button type="button" onClick={() => setOpen((o) => !o)} style={summaryStyle}>
        <Icon name="person" size={14} strokeWidth={1.6} />
        <span style={labelStyle}>
          {assignees.length === 0 ? "Unassigned" : assignees.map((a) => a.name).join(", ")}
        </span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", display: "flex" }}>
          <Icon name="chevron" size={14} strokeWidth={1.6} color="#6b6b6b" />
        </span>
      </button>
      {open && (
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
      )}
      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

const summaryStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  fontSize: 12.5,
  padding: "9px 10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  color: "#000",
  background: "white",
  fontWeight: 400,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
};

const labelStyle = {
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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
