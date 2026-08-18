"use client";

import { useEffect, useState } from "react";

// "Add to Home Screen" prompt. Two very different platforms:
//
// - Android/Chrome fires a `beforeinstallprompt` event we can capture and
//   replay from a button - one tap installs.
// - iOS Safari has no such event and never will; the only route is the
//   Share sheet -> "Add to Home Screen", so there we show instructions.
//
// Shown only when NOT already installed (display-mode: standalone), and
// dismissible - a nag that won't go away is worse than no banner. The
// dismissal is remembered in localStorage so it doesn't return every load.
const DISMISS_KEY = "patchup-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY)) return;

    // Android path: capture the install event.
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS path: no event exists, so show the banner on Safari directly.
    if (isIos()) setShow(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    setShowIosHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (isIos()) {
      setShowIosHelp(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div style={wrapStyle}>
      {showIosHelp ? (
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Tap the Share button in Safari, then <strong>Add to Home Screen</strong>.
          <button onClick={dismiss} style={linkBtnStyle}>Got it</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={34} height={34} style={{ borderRadius: 7 }} />
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>
            <strong>Install PatchUp</strong>
            <div style={{ color: "#9a9a9a" }}>Add it to your home screen for one-tap access.</div>
          </div>
          <button onClick={install} style={installBtnStyle}>Install</button>
          <button onClick={dismiss} style={closeBtnStyle} aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  );
}

const wrapStyle = {
  position: "fixed",
  left: 12,
  right: 12,
  bottom: 84,
  maxWidth: 480,
  margin: "0 auto",
  background: "white",
  border: "1px solid #e2e2e2",
  borderRadius: 10,
  boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
  padding: 12,
  zIndex: 25,
};
const installBtnStyle = {
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
const linkBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#111",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
  marginLeft: 8,
  textDecoration: "underline",
  fontFamily: "inherit",
};
