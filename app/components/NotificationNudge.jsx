"use client";

import { useEffect, useState } from "react";
import { enablePushOnThisDevice } from "../lib/enablePush";
import { loadFieldPack } from "../lib/fieldPackStore";

// A one-time, dismissible invitation to turn notifications on - never the
// raw browser popup uninvited. A reflexive "Don't Allow" on an uninvited
// prompt is permanent (the browser refuses to ask again), so the real
// permission dialog only ever appears after a deliberate tap here.
//
// Shows only when it can actually deliver: push supported on this device
// (on iPhone that means installed to the home screen - the install banner
// owns that conversation, so this one stays silent there), permission not
// yet decided, not already subscribed, not previously dismissed, and the
// person has at least one upcoming job (read from the on-device field
// pack - the nudge can name real value, not hypothetical value).
const DISMISS_KEY = "patchup-notif-nudge-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function NotificationNudge({ vapidPublicKey }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(null); // "on" | "error"

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
        if (!vapidPublicKey) return;
        if (localStorage.getItem(DISMISS_KEY)) return;
        if (Notification.permission !== "default") return;
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (ios && !isStandalone()) return; // push can't work there; install banner leads
        const reg = await navigator.serviceWorker.ready;
        if (await reg.pushManager.getSubscription()) return;
        const pack = await loadFieldPack().catch(() => null);
        if (!pack?.jobs?.length) return;
        setShow(true);
      } catch {}
    })();
  }, [vapidPublicKey]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function turnOn() {
    setBusy(true);
    const result = await enablePushOnThisDevice(vapidPublicKey);
    setBusy(false);
    if (result.ok) {
      setState("on");
      setTimeout(dismiss, 2500);
    } else if (result.denied) {
      dismiss(); // they answered; never raise it again
    } else {
      setState("error");
    }
  }

  if (!show) return null;

  return (
    <div style={wrapStyle}>
      {state === "on" ? (
        <div style={{ fontSize: 13 }}>Notifications on — you&apos;ll get a nudge before each job. ✓</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
            <strong>Never miss a job</strong>
            <div style={{ color: "#9a9a9a" }}>
              {state === "error"
                ? "That didn't work - you can turn them on in My Account."
                : "Get a nudge an hour before each job starts."}
            </div>
          </div>
          <button onClick={turnOn} disabled={busy} style={onBtnStyle}>
            {busy ? "..." : "Turn on"}
          </button>
          <button onClick={dismiss} style={closeBtnStyle} aria-label="Not now">×</button>
        </div>
      )}
    </div>
  );
}

const wrapStyle = {
  position: "fixed",
  left: 12,
  right: 12,
  bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
  maxWidth: 480,
  margin: "0 auto",
  background: "white",
  border: "1px solid #e2e2e2",
  borderRadius: 10,
  boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
  padding: 12,
  zIndex: 24,
};
const onBtnStyle = {
  background: "#111",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "9px 14px",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};
const closeBtnStyle = {
  background: "transparent",
  border: "none",
  fontSize: 20,
  color: "#9a9a9a",
  cursor: "pointer",
  lineHeight: 1,
  padding: "0 4px",
};
