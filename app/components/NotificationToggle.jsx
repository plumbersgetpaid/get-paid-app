"use client";

import { useEffect, useState } from "react";

// Turn push notifications on/off for this device.
//
// The states this has to handle honestly, because push is fiddly:
//  - browser doesn't support push at all -> hide
//  - iOS not installed to home screen -> push is impossible in Safari, so
//    tell them to install rather than showing a button that can't work
//  - permission denied earlier -> the browser won't ask again; tell them
//    to change it in settings
//  - supported and allowed -> a real toggle
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function isIosNotStandalone() {
  if (typeof navigator === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  return ios && !standalone;
}

export default function NotificationToggle({ vapidPublicKey }) {
  const [supported, setSupported] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (isIosNotStandalone()) {
      setSupported(false);
      setNeedsInstall(true);
      return;
    }
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return;
      }
      // Key rotation handling. The browser's subscription is bound to the
      // VAPID key it was created with; after a rotation it looks "on" here
      // while the server can no longer send to it. Detect the mismatch,
      // drop the stale subscription, and show the enable button again.
      if (vapidPublicKey && sub.options?.applicationServerKey) {
        const current = new Uint8Array(sub.options.applicationServerKey);
        const expected = urlBase64ToUint8Array(vapidPublicKey);
        const same =
          current.length === expected.length && current.every((b, i) => b === expected[i]);
        if (!same) {
          await sub.unsubscribe().catch(() => {});
          setSubscribed(false);
          setMsg("Notifications need switching back on after an app update.");
          return;
        }
      }
      setSubscribed(true);
      // Self-heal: re-register with the server (an upsert), so a lost or
      // cleared server row comes back without the person doing anything.
      fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      }).catch(() => {});
    });
  }, [vapidPublicKey]);

  async function enable() {
    if (!vapidPublicKey) {
      setMsg("Notifications aren't set up on the server yet.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg(
          permission === "denied"
            ? "Notifications are blocked. Turn them on for this site in your browser settings."
            : "Notifications weren't allowed."
        );
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      } catch (subErr) {
        // A leftover subscription on a different (rotated) key blocks new
        // ones - clear it and try once more.
        const stale = await reg.pushManager.getSubscription();
        if (stale) await stale.unsubscribe().catch(() => {});
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error("save failed");
      setSubscribed(true);
      setMsg("Notifications are on for this device.");
    } catch (e) {
      console.error("Enable notifications failed:", e);
      setMsg("Couldn't turn notifications on. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Notifications are off for this device.");
    } catch (e) {
      console.error("Disable notifications failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMsg(data.sent ? "Test sent - check your notifications." : "No devices to send to.");
    setBusy(false);
  }

  if (supported === null) return null;

  if (needsInstall) {
    return (
      <div style={cardStyle}>
        <div style={labelStyle}>Notifications</div>
        <p style={helpStyle}>
          To get notifications on iPhone, add PatchUp to your home screen first (Share
          → Add to Home Screen), then open it from there.
        </p>
      </div>
    );
  }

  if (!supported) {
    return (
      <div style={cardStyle}>
        <div style={labelStyle}>Notifications</div>
        <p style={helpStyle}>This browser doesn&apos;t support notifications.</p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Notifications on this device</div>
      <p style={helpStyle}>
        Get a nudge before a job starts and when something needs your attention. Set
        per device - turn it on wherever you want alerts.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {subscribed ? (
          <>
            <button onClick={disable} disabled={busy} style={quietBtn}>
              Turn off
            </button>
            <button onClick={sendTest} disabled={busy} style={quietBtn}>
              Send a test
            </button>
          </>
        ) : (
          <button onClick={enable} disabled={busy} style={primaryBtn}>
            {busy ? "..." : "Turn on notifications"}
          </button>
        )}
      </div>
      {msg && <p style={{ ...helpStyle, marginTop: 10, marginBottom: 0 }}>{msg}</p>}
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: "var(--card-pad, 16px)",
  margin: "16px 0",
  border: "1px solid #e2e2e2",
};
const labelStyle = { fontSize: 15, fontWeight: 500, marginBottom: 6 };
const helpStyle = { fontSize: 12.5, color: "#888", marginTop: 0, marginBottom: 12, lineHeight: 1.5 };
const primaryBtn = {
  background: "#111",
  color: "white",
  border: "none",
  borderRadius: 2,
  padding: "11px 16px",
  fontWeight: 500,
  fontSize: 13.5,
  cursor: "pointer",
  fontFamily: "inherit",
};
const quietBtn = {
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  borderRadius: 2,
  padding: "11px 16px",
  fontWeight: 500,
  fontSize: 13.5,
  cursor: "pointer",
  fontFamily: "inherit",
};
