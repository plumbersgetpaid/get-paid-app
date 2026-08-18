"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Where Stripe's "Return to PatchUp" button lands after managing billing.
//
// Plan A: this tab was opened by window.open(), and a script-opened tab
// may close itself - so close it, and the person is back in the original
// app tab exactly where they left, with no Stripe history anywhere.
//
// Plan B, because mobile browsers often refuse close() once a tab has
// navigated through another origin: this orphan tab is about to become
// the person's app tab, and its entire history is Stripe pages, so back
// would walk into an expired portal and "stop working". A site can't
// delete another origin's entries - but it CAN relabel the current one
// and build forward from it. Relabel this entry as /settings, then do a
// real navigation to /billing on top: back now lands on Settings like it
// would in a tab with an honest past. (Two backs still reach a dead
// Stripe page - that entry is beyond anyone's power to remove - but one
// back is what people actually press.)
export default function PortalReturn() {
  const router = useRouter();
  const [closing, setClosing] = useState(true);

  useEffect(() => {
    window.close();
    const timer = setTimeout(() => {
      setClosing(false);
      window.history.replaceState(null, "", "/settings");
      router.push("/billing");
    }, 400);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "#666" }}>
        {closing ? "All done - closing this tab..." : "Taking you back to billing..."}
      </p>
    </main>
  );
}
