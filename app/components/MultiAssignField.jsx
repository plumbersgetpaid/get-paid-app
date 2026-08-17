"use client";

import { useState } from "react";
import Icon from "./Icon";

export default function MultiAssignField({ teamMembers, name = "assignedTo", initialSelectedIds = [] }) {
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));
  const [open, setOpen] = useState(false);

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

      {/* Was a <details>/<summary>, which stacked three deep: the
          browser's own disclosure triangle on one line, the icon on
          the next (it's a block element in a non-flex parent), then
          the label. A button gives one row and full control of the
          marker. */}
      <button type="button" onClick={() => setOpen((o) => !o)} style={summaryStyle}>
        <Icon name="person" size={15} strokeWidth={1.6} />
        <span style={labelStyle}>
          {selectedNames.length === 0 ? "Unassigned" : selectedNames.join(", ")}
        </span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", display: "flex" }}>
          <Icon name="chevron" size={15} strokeWidth={1.6} color="#6b6b6b" />
        </span>
      </button>

      {open && (
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
            <div style={{ fontSize: 12, color: "#6b6b6b" }}>No team members yet</div>
          )}
        </div>
      )}
    </div>
  );
}

const summaryStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  fontSize: 13.5,
  padding: "11px 12px",
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
  fontSize: 14,
  padding: "9px 6px",
};
