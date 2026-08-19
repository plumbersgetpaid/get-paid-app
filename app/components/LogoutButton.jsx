"use client";

import { useState } from "react";
import { clearFieldData } from "../lib/fieldPackStore";
import { countPending } from "../lib/outbox";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    // Unsent offline work is destroyed by logout (it must be - it contains
    // customer data). Destroying it silently would be worse than the one
    // browser confirm() this app otherwise avoids.
    const pending = await countPending().catch(() => 0);
    if (pending > 0) {
      const sure = window.confirm(
        `You have ${pending} unsent update${pending === 1 ? "" : "s"} saved on this phone (work done offline). Logging out deletes ${pending === 1 ? "it" : "them"} permanently. Get back into signal first to send ${pending === 1 ? "it" : "them"}, or log out anyway?`
      );
      if (!sure) return;
    }
    setBusy(true);
    // The field pack holds customer names, phones and addresses - it must
    // not outlive the session on a shared or handed-back device.
    await clearFieldData();
    try {
      // 5s, not 15s - this route does nothing but clear a cookie (no
      // database call at all), so it should resolve in well under a
      // second normally. A short timeout here means any hiccup falls
      // through to the navigation quickly instead of leaving someone
      // stuck waiting most of 15 seconds out for nothing.
      await fetch("/api/auth/logout", {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.error("Logout error:", err);
      // Even if the request itself failed, still send them to the login
      // page - worst case the cookie is still set and they land straight
      // back here, which is safer than leaving them stuck on a stale page
    }
    // Full navigation, not a soft router push - guarantees a fresh,
    // uncached load of the login page rather than anything left over
    // from the logged-in session
    window.location.href = "/login";
  }

  return (
    <button onClick={handleLogout} disabled={busy} style={logoutButtonStyle}>
      {busy ? "Logging out..." : "Log out"}
    </button>
  );
}

const logoutButtonStyle = {
  background: "white",
  color: "#991b1b",
  padding: "10px 16px",
  borderRadius: 2,
  border: "1px solid #fecaca",
  fontWeight: 500,
  fontSize: 13,
};
