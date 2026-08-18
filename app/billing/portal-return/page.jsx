"use client";

import { useEffect, useState } from "react";

// Where Stripe's "Return to PatchUp" button lands after managing billing.
//
// The portal opens in a tab we created with window.open(), and a tab a
// script opened is allowed to close itself. So this page's whole job is
// window.close() - the tab vanishes and the person is back in the
// original app tab, exactly where they left it, with no Stripe history
// anywhere for a back button to wander into. That history was the mobile
// bug: back from the portal walked through expired Stripe pages and
// looped between settings and billing, and no amount of history juggling
// fixed it, because a site can't edit another origin's entries. Not
// creating the history is the only version that works.
//
// If close() is refused (the popup-blocked fallback navigated the
// original tab here instead, so we didn't open it), fall through to
// replace() - which at least swaps this page out of history rather than
// stacking on top.
export default function PortalReturn() {
  const [closing, setClosing] = useState(true);

  useEffect(() => {
    window.close();
    // Still alive a moment later means the browser refused - this tab
    // wasn't script-opened. Go back to billing without adding history.
    const timer = setTimeout(() => {
      setClosing(false);
      window.location.replace("/billing");
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "#666" }}>
        {closing ? "All done - closing this tab..." : "Taking you back to billing..."}
      </p>
    </main>
  );
}
