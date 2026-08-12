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
    }
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
