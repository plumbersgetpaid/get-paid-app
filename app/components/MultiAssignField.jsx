"use client";

import { useState } from "react";

export default function MultiAssignField({ teamMembers, name = "assignedTo", initialSelectedIds = [] }) {
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedNames = teamMembers
    .filter((m) => selectedIds.has(m.id))
    .map((m) => m.name);

  return (
    <div>
      {[...selectedIds].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <details>
        <summary style={summaryStyle}>
          👤 {selectedNames.length === 0 ? "Unassigned" : selectedNames.join(", ")}
        </summary>
        <div style={optionsBoxStyle}>
          {teamMembers.map((m) => (
            <label key={m.id} style={optionRowStyle}>
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => toggle(m.id)}
              />
              {m.name}
            </label>
          ))}
          {teamMembers.length === 0 && (
            <div style={{ fontSize: 12, color: "#888" }}>No team members yet</div>
          )}
        </div>
      </details>
    </div>
  );
}

const summaryStyle = {
  fontSize: 13,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  color: "#111",
  background: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const optionsBoxStyle = {
  marginTop: 6,
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 6,
};

const optionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  padding: "8px 6px",
};
