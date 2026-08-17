"use client";

import { useEffect, useState } from "react";

// Handles the gap between paying and the app knowing about it.
//
// Stripe sends the webhook to our server, not the browser, so after
// checkout the billing page can load before that event has landed -
// showing stale status with no indication anything is coming. Telling
// someone to "wait a few seconds" and leaving them to refresh manually
// is the worst version of this. So: poll quietly until it flips, then
// refresh once.
//
// Also drops the dead Stripe session out of browser history, so
// pressing back doesn't land on "you're all done here", which reads
// like a failure when the payment actually succeeded.
export default function PostCheckout({ alreadyActive }) {
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    // Replace the ?done=1 entry so back skips over both this and the
    // expired Stripe page.
    if (typeof window !== "undefined" && window.location.search.includes("done=1")) {
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  useEffect(() => {
    if (alreadyActive) return;

    let cancelled = false;
    let attempts = 0;

    async function check() {
      attempts += 1;
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.active) {
          window.location.reload();
          return;
        }
      } catch {
        // A failed check is fine - it just tries again.
      }

      if (cancelled) return;

      // Give up after about 30 seconds rather than polling forever.
      if (attempts >= 15) {
        setWaited(-1);
        return;
      }
      setWaited(attempts * 2);
      setTimeout(check, 2000);
    }

    const t = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [alreadyActive]);

  if (alreadyActive) return null;

  if (waited === -1) {
    return (
      <div style={warnStyle}>
        Your payment went through, but it&apos;s taking longer than usual to
        show here. Refresh in a minute - and if it still looks wrong, get in
        touch and we&apos;ll sort it.
      </div>
    );
  }

  return (
    <div style={waitStyle}>
      {/* Keyframes can't live in an inline style object, and the app
          has no global stylesheet, so the animation is declared here
          alongside the only thing that uses it. */}
      <style>{"@keyframes patchup-spin { to { transform: rotate(360deg) } }"}</style>
      <span style={spinnerStyle} />
      Confirming your payment with Stripe...
    </div>
  );
}

const waitStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#fff",
  border: "1px solid #e2e2e2",
  borderRadius: 3,
  padding: "12px 14px",
  fontSize: 13.5,
  color: "#6b6b6b",
  marginTop: 14,
};

const warnStyle = {
  background: "#fef3c7",
  border: "1px solid #fde68a",
  color: "#92400e",
  borderRadius: 3,
  padding: "12px 14px",
  fontSize: 13,
  marginTop: 14,
  lineHeight: 1.5,
};

const spinnerStyle = {
  width: 12,
  height: 12,
  borderRadius: 6,
  border: "2px solid #d4d4d4",
  borderTopColor: "#000",
  display: "inline-block",
  animation: "patchup-spin 0.7s linear infinite",
};
