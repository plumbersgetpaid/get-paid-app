"use client";

import { useEffect } from "react";

// Registers the service worker once, client-side. Kept out of the install
// banner so registration happens on every page even before anyone thinks
// about installing.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("Service worker registration failed:", e);
    });
  }, []);
  return null;
}
