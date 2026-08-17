"use client";

import { useEffect } from "react";

// Stops the back-button loop after returning from Stripe.
//
// Stripe's checkout and portal live on stripe.com, so they sit in
// browser history like any other site. Come back and Stripe is the
// previous entry: press back and you're on an expired session, press
// back again and you bounce into the app, and round it goes.
//
// A site cannot delete another origin's history entry - that's a
// browser security boundary, not something to code around. So this
// intercepts instead: on arrival it pushes one extra entry, and
// catches the back press against it, sending you to the dashboard
// rather than letting the browser walk backwards into Stripe.
export default function StripeReturnCleanup({ to = "/" }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const cameFromStripe =
      document.referrer.includes("stripe.com") ||
      window.location.search.includes("done=1");

    if (!cameFromStripe) return;

    // Tidy the URL so a refresh doesn't re-trigger any ?done=1 handling.
    const clean = window.location.pathname;
    window.history.replaceState({ patchupReturn: true }, "", clean);

    // One spare entry to absorb the first back press.
    window.history.pushState({ patchupGuard: true }, "", clean);

    function onPop() {
      window.removeEventListener("popstate", onPop);
      // Full navigation rather than history movement, so this can't
      // walk further back into Stripe.
      window.location.href = to;
    }

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [to]);

  return null;
}
