"use client";

import { useState } from "react";

export default function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(e.target);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't send that - try again");
        setBusy(false);
        return;
      }

      // Same success screen no matter what the server actually found -
      // the point of the generic wording is lost if the UI then reacts
      // differently based on some other signal
      setSent(true);
    } catch (err) {
      console.error("Forgot password error:", err);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setError("This is taking much longer than it should - try again in a moment.");
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div style={successBoxStyle}>
        If that email has an account, a reset link is on its way - check
        your inbox (and spam folder, just in case).
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      <label style={labelStyle}>
        Email
        <input name="email" type="email" required autoComplete="email" style={inputStyle} />
      </label>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Sending..." : "Send reset link"}
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

const successBoxStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 14,
  borderRadius: 2,
  fontSize: 14,
  textAlign: "center",
};
