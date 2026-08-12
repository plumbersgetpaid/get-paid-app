"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
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
  borderRadius: 8,
  border: "1px solid #fecaca",
  fontWeight: 600,
  fontSize: 13,
};
