"use client";

import { useState } from "react";
import { clearFieldData } from "../lib/fieldPackStore";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
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
