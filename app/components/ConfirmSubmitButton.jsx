"use client";

import { useState } from "react";

// Wraps a destructive submit button so it asks first.
//
// Declining a quote, deleting a job, removing a note - all of these
// were previously a single tap with no way back, on a phone, often
// with one hand while holding something else. This puts one
// deliberate step in the way.
//
// Deliberately not a browser confirm(): those get dismissed on
// reflex, look nothing like the rest of the app, and on some mobile
// browsers can be suppressed entirely. This asks in place instead, so
// the question appears where the action is.
export default function ConfirmSubmitButton({
  children,
  confirmText = "Are you sure?",
  confirmLabel = "Yes, do it",
  cancelLabel = "Cancel",
  style,
  confirmStyle,
  // "danger" for anything that destroys data, "neutral" for a reversible
  // action that still deserves a beat of thought. Pausing a recurring job
  // stops future work being created, which is worth confirming - but it
  // isn't a deletion, and dressing it in red would cry wolf.
  tone = "danger",
}) {
  const isDanger = tone === "danger";
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} style={style}>
        {children}
      </button>
    );
  }

  return (
    <div style={isDanger ? wrapStyle : neutralWrapStyle}>
      <div style={isDanger ? questionStyle : neutralQuestionStyle}>{confirmText}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setAsking(false)} style={cancelStyle}>
          {cancelLabel}
        </button>
        <button
          type="submit"
          style={{
            ...confirmButtonStyle,
            ...(isDanger ? null : neutralConfirmStyle),
            ...confirmStyle,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

const wrapStyle = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 3,
  padding: 12,
  marginTop: 8,
  // Wide enough that when this sits in a row of buttons the row wraps
  // and the question gets a line of its own, rather than being squeezed
  // into a third of the width.
  minWidth: 240,
  flexGrow: 1,
};

const neutralWrapStyle = {
  ...wrapStyle,
  background: "#f6f7f9",
  border: "1px solid #e2e2e2",
};

const neutralQuestionStyle = {
  fontSize: 13,
  color: "#444",
  marginBottom: 10,
  lineHeight: 1.45,
};

const neutralConfirmStyle = {
  background: "#111",
};

const questionStyle = {
  fontSize: 13,
  color: "#991b1b",
  marginBottom: 10,
  lineHeight: 1.45,
};

const cancelStyle = {
  flex: 1,
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  borderRadius: 2,
  padding: "10px 12px",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};

const confirmButtonStyle = {
  flex: 1,
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: 2,
  padding: "10px 12px",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};
