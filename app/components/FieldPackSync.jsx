"use client";

import { useEffect } from "react";
import { saveFieldPack, kvGet, kvSet } from "../lib/fieldPackStore";
import { syncOutbox } from "../lib/outbox";

// Keeps the offline layer honest. On every page load and whenever the
// connection returns: first replay the outbox (work done offline), THEN
// refresh the field pack - in that order, so the saved copy reflects what
// was just sent. Pack refresh is throttled; outbox sync never is, because
// pending work should leave the phone at the first opportunity.
const SYNC_EVERY_MS = 5 * 60 * 1000;

export default function FieldPackSync() {
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!navigator.onLine) return;
      try {
        const result = await syncOutbox();
        const sentSomething = (result?.sent || 0) > 0;

        const last = await kvGet("lastFieldSync");
        if (!sentSomething && last && Date.now() - last < SYNC_EVERY_MS) return;

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
