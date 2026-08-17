"use client";

import { useState } from "react";

export default function AddTeamMemberForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.target);
    const password = form.get("password");
    const confirmPassword = form.get("confirmPassword");

    if (password !== confirmPassword) {
      setError("Those passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password needs to be at least 8 characters");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/team/add", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't add that person");
        setBusy(false);
        return;
      }

      window.location.reload();
    } catch (err) {
      console.error("Add team member error:", err);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setError("This is taking much longer than it should - try again in a moment.");
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 8 }}>
      <input name="name" placeholder="Their name" required style={inputStyle} />
      <input name="email" type="email" placeholder="Their email" required style={inputStyle} />

      <select name="role" defaultValue="subcontractor" required style={inputStyle}>
        <option value="subcontractor">Subcontractor - only sees their own assigned jobs</option>
        <option value="manager">Manager - sees everything, same as you</option>
      </select>

      <input
        name="password"
        type="password"
        placeholder="Set a password for them"
        minLength={8}
        required
        style={inputStyle}
      />
      <input
        name="confirmPassword"
        type="password"
        placeholder="Confirm password"
        required
        style={inputStyle}
      />
      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
        Share this password with them directly (text, in person) - they can
        change it themselves afterward from their own Account page.
      </p>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Adding..." : "Add to team"}
      </button>
    </form>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  fontWeight: 400,
  color: "#000",
  width: "100%",
  boxSizing: "border-box",
  background: "white",
};

const submitButtonStyle = {
  background: "#000",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  fontSize: 15,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
};
