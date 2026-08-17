"use client";

import { useState } from "react";

const BASE = 19;
const EXTRA = 8;

export default function SignupForm({ initialTeamSize = 1 }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [teamSize, setTeamSize] = useState(initialTeamSize);

  const monthly = BASE + (teamSize - 1) * EXTRA;

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

    form.set("teamSize", String(teamSize));

    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't create your account - try again");
        setBusy(false);
        return;
      }

      window.location.href = "/";
    } catch (err) {
      console.error("Signup error:", err);
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
        Business name
        <input
          name="businessName"
          required
          autoComplete="organization"
          placeholder="e.g. Wilkinson Plumbing"
          style={inputStyle}
        />
        <span style={hintStyle}>This goes on your quotes and invoices</span>
      </label>

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
        <span style={hintStyle}>At least 8 characters</span>
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

      <div style={labelStyle}>
        How many of you are there?
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTeamSize(n)}
              style={teamSize === n ? sizeOnStyle : sizeStyle}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            min="1"
            max="500"
            inputMode="numeric"
            value={teamSize}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (n > 0) setTeamSize(Math.min(n, 500));
            }}
            style={sizeInputStyle}
            aria-label="Team size"
          />
        </div>
        <span style={hintStyle}>
          £{monthly} a month after your trial · change it any time
        </span>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Setting up..." : "Start 14-day free trial"}
      </button>

      <p style={smallPrintStyle}>
        No card needed. We&apos;ll remind you before the trial ends.
      </p>
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

const hintStyle = { fontWeight: 400, color: "#6b6b6b", fontSize: 12 };

const sizeStyle = {
  minWidth: 42,
  padding: "10px 8px",
  border: "1px solid #e2e2e2",
  background: "white",
  color: "#000",
  borderRadius: 2,
  fontSize: 13.5,
  cursor: "pointer",
  fontFamily: "inherit",
};

const sizeOnStyle = { ...sizeStyle, background: "#000", color: "white", borderColor: "#000" };

const sizeInputStyle = {
  width: 64,
  padding: "10px 8px",
  border: "1px solid #e2e2e2",
  borderRadius: 2,
  fontSize: 13.5,
  textAlign: "center",
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

const smallPrintStyle = {
  fontSize: 12,
  color: "#6b6b6b",
  textAlign: "center",
  margin: 0,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
};
