"use client";

import { useState } from "react";

export default function DateFieldWithHint({ name, defaultValue, label }) {
  const [value, setValue] = useState(defaultValue || "");

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
        {!value && <span style={hintStyle}>dd/mm/yyyy</span>}
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
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
  background: "white",
  position: "relative",
};

const hintStyle = {
  position: "absolute",
  left: 11,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#767676",
  fontSize: 14,
  pointerEvents: "none",
  zIndex: 1,
};
