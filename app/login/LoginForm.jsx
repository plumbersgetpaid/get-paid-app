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

      // A full navigation, not a soft router push - guarantees the next
      // page is genuinely fetched fresh from the server rather than
      // reusing anything cached from before login
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

      {/* A plain anchor, not Next's Link component - Link specifically
          was what caused the earlier crash on this page, for reasons
          not yet fully understood. A plain anchor means a full page
          load rather than client-side navigation when tapped, which is
          a trivial trade-off for a link used this rarely. */}
      <a href="/forgot-password" style={{ fontSize: 13, color: "#666", textAlign: "right" }}>
        Forgot password?
      </a>

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
