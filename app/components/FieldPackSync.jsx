"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { saveFieldPack, kvGet, kvSet } from "../lib/fieldPackStore";
import { syncOutbox } from "../lib/outbox";

// Keeps the offline layer honest. On every page load and whenever the
// connection returns: first replay the outbox (work done offline), THEN
// refresh the field pack - in that order, so the saved copy reflects what
// was just sent. Pack refresh is throttled; outbox sync never is, because
// pending work should leave the phone at the first opportunity.
// 45 seconds, not minutes: someone books a job and walks into a dead zone
// straight after - the saved copy has to catch changes that fresh. The
// pack query is a handful of small selects; cheapness is the point of it.
const SYNC_EVERY_MS = 45 * 1000;

let warmedThisSession = false;

export default function FieldPackSync() {
  // Re-run on every navigation, not just hard loads - the layout persists
  // across App Router navigations, so without this the effect fires once
  // per session and booking a job would never refresh the saved copy.
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
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
        // Warming re-fetches the /field shell and its chunks - worth doing
        // once per session and on reconnect, not on every pack refresh.
        if (!warmedThisSession) {
          warmedThisSession = true;
          navigator.serviceWorker?.controller?.postMessage({ type: "warm-field" });
        }
      } catch {
        // Offline or flaky - the whole point is that this can fail quietly.
      }
    }

    // A beat after navigation settles, never in its critical path.
    const t = setTimeout(sync, 1200);
    const onOnline = () => {
      warmedThisSession = false; // reconnect may follow a deploy - re-warm
      sync();
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener("online", onOnline);
    };
  }, [pathname]);

  return null;
}
