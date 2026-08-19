"use client";

import { useEffect } from "react";
import { saveFieldPack, kvGet, kvSet } from "../lib/fieldPackStore";

// Keeps the field pack fresh. Runs on every page while logged in: on
// mount and whenever the connection comes back, it refreshes the pack
// (at most every 5 minutes) and asks the service worker to warm the
// /field shell so the offline view works even if it's never been
// visited.
const SYNC_EVERY_MS = 5 * 60 * 1000;

export default function FieldPackSync() {
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!navigator.onLine) return;
      try {
        const last = await kvGet("lastFieldSync");
        if (last && Date.now() - last < SYNC_EVERY_MS) return;
        const res = await fetch("/api/field-pack");
        if (!res.ok || cancelled) return;
        const pack = await res.json();
        await saveFieldPack(pack);
        await kvSet("lastFieldSync", Date.now());
        navigator.serviceWorker?.controller?.postMessage({ type: "warm-field" });
      } catch {
        // Offline or flaky - the whole point is that this can fail quietly.
      }
    }

    sync();
    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
    };
  }, []);

  return null;
}
