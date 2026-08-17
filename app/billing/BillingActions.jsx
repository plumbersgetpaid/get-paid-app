"use client";

import { useState } from "react";

export default function BillingActions({ hasSubscription }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function go(endpoint, which) {
    setError(null);
    setBusy(which);

    // Opened synchronously, before the await, because a window.open
    // that happens after an async gap is no longer tied to the click
    // and gets blocked. So: open a blank tab now, point it at Stripe
    // once we have the URL.
    //
    // The tab matters. Sending the current tab to Stripe puts
    // stripe.com in this tab's history, and no amount of history
    // manipulation reliably keeps the back button from walking into an
    // expired Stripe session - a site can't remove another origin's
    // history entry. A separate tab sidesteps it entirely: this tab's
    // history is never touched.
    const tab = window.open("", "_blank");

    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.url) {
        if (tab) tab.close();
        setError(data.error || "Couldn't do that - try again in a moment.");
        setBusy(null);
        return;
      }

      if (tab) {
        tab.location.href = data.url;
        setBusy(null);
      } else {
        // Popup blocked - fall back to this tab rather than leaving
        // them stuck with nothing happening.
        window.location.href = data.url;
      }
    } catch (e) {
      console.error("Billing action error:", e);
      if (tab) tab.close();
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
        Opens in a new tab. Card details are handled entirely by Stripe and
        never touch PatchUp.
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
  lineHeight: 1.5,
};

const errorStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
};
