"use client";

import { useState } from "react";

export default function ResetPasswordForm({ token }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("token", token);
      form.append("newPassword", newPassword);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't reset your password - try again");
        setBusy(false);
        return;
      }

      // Full navigation, not a soft router push - matches the same
      // pattern login itself uses, and guarantees a genuinely fresh load
      window.location.href = "/login";
    } catch (err) {
      console.error("Reset password error:", err);
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
        New password
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Confirm new password
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          style={inputStyle}
        />
      </label>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <button type="submit" disabled={busy || !newPassword} style={submitButtonStyle}>
        {busy ? "Saving..." : "Set new password"}
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
