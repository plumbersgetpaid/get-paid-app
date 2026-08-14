"use client";

import { useState, useEffect } from "react";

export default function DateFieldWithHint({ name, defaultValue, label }) {
  const [value, setValue] = useState(defaultValue || "");
  const [showCustomHint, setShowCustomHint] = useState(false);

  useEffect(() => {
    setShowCustomHint(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);

  return (
    <label style={labelStyle}>
      {label}
      <div style={wrapperStyle}>
        <input
          type="date"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={dateInputStyle}
        />
        {showCustomHint && !value && (
          <span style={hintStyle}>
            <span>dd/mm/yyyy</span>
            <span>📅</span>
          </span>
        )}
      </div>
    </label>
  );
}

const labelStyle = {
  flex: 1,
  minWidth: 0,
  fontSize: 12,
  color: "#666",
  display: "block",
};

const wrapperStyle = {
  position: "relative",
  marginTop: 4,
};

const dateInputStyle = {
  display: "block",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "12px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
  background: "white",
  position: "relative",
};

const hintStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 11px",
  color: "#767676",
  fontSize: 14,
  pointerEvents: "none",
  zIndex: 1,
};
