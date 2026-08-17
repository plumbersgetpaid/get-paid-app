"use client";

import { useState } from "react";

export default function TemplateForm({ templateKey, subjectValue, bodyValue, noSubject, rows }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);

    const formData = new FormData(e.target);
    formData.append("key", templateKey);

    try {
      const res = await fetch("/api/settings/templates", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't save this template.");
        setBusy(false);
        return;
      }

      setSaved(true);
      setBusy(false);
    } catch (err) {
      console.error("Save template error:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
      {saved && <div style={savedBannerStyle}>Saved.</div>}
      {error && <div style={errorBoxStyle}>{error}</div>}

      {!noSubject && (
        <label style={labelStyle}>
          Subject
          <input name="subject" defaultValue={subjectValue} style={inputStyle} />
        </label>
      )}

      <label style={labelStyle}>
        Message
        <textarea
          name="body"
          defaultValue={bodyValue}
          rows={rows}
          required
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>

      <button type="submit" disabled={busy} style={saveButtonStyle}>
        {busy ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  color: "#666",
  fontWeight: 500,
};

const inputStyle = {
  padding: "10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 14,
  fontWeight: 400,
  color: "#000",
  width: "100%",
  boxSizing: "border-box",
};

const saveButtonStyle = {
  background: "#000",
  color: "white",
  padding: "10px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  fontSize: 13,
};

const savedBannerStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 8,
  borderRadius: 2,
  fontSize: 12,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 8,
  borderRadius: 2,
  fontSize: 12,
};
