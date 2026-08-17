"use client";

import { useState } from "react";

export default function BillingActions({ hasSubscription }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function go(endpoint, which) {
    setError(null);
    setBusy(which);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't do that - try again in a moment.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      console.error("Billing action error:", e);
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {error && <div style={errorStyle}>{error}</div>}

      {hasSubscription ? (
        <button
          type="button"
          onClick={() => go("/api/billing/portal", "portal")}
          disabled={busy !== null}
          style={primaryStyle}
        >
          {busy === "portal" ? "Opening..." : "Manage billing"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => go("/api/billing/checkout", "checkout")}
          disabled={busy !== null}
          style={primaryStyle}
        >
          {busy === "checkout" ? "Opening..." : "Set up payment"}
        </button>
      )}

      <p style={noteStyle}>
        Card details are handled entirely by Stripe. They never touch PatchUp.
      </p>
    </div>
  );
}

const primaryStyle = {
  background: "#000",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  fontSize: 14.5,
  cursor: "pointer",
  fontFamily: "inherit",
};

const noteStyle = {
  fontSize: 12,
  color: "#6b6b6b",
  textAlign: "center",
  margin: 0,
};

const errorStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
};
