"use client";

import { useState } from "react";

export default function SetupForm() {
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
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't create the account - try again");
        setBusy(false);
        return;
      }

      window.location.href = "/";
    } catch (err) {
      console.error("Setup error:", err);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setError("This is taking much longer than it should - try again in a moment.");
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      <label style={labelStyle}>
        Your name
        <input name="name" required autoComplete="name" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        Email
        <input name="email" type="email" required autoComplete="email" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={inputStyle}
        />
        <span style={{ fontWeight: 400, color: "#888", fontSize: 12 }}>
          At least 8 characters
        </span>
      </label>

      <label style={labelStyle}>
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          style={inputStyle}
        />
      </label>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Setting up..." : "Create owner account"}
      </button>
    </form>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#666",
  fontWeight: 500,
};

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  fontWeight: 400,
  color: "#000",
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
