"use client";

import { useState } from "react";

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(e.target);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't log in - try again");
        setBusy(false);
        return;
      }

      window.location.href = "/";
    } catch (err) {
      console.error("Login error:", err);
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
        Email
        <input name="email" type="email" required autoComplete="email" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={inputStyle}
        />
      </label>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#666",
  fontWeight: 600,
};

const inputStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  fontWeight: 400,
  color: "#111",
};

const submitButtonStyle = {
  background: "#111",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  fontSize: 15,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 8,
  fontSize: 13,
};
