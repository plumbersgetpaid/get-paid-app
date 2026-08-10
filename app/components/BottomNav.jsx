"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "🏠", label: "Today" },
  { href: "/work", icon: "📋", label: "Work" },
  { href: "/calendar", icon: "📅", label: "Calendar" },
  { href: "/clients", icon: "👤", label: "Clients" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // The nav lives in the shared layout, which doesn't unmount between page
  // navigations - so close the menu explicitly whenever the route changes,
  // as a safety net alongside the explicit close-on-click handlers below.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={backdropStyle} aria-hidden="true" />
      )}

      <div style={fabWrapperStyle}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          style={fabButtonStyle}
          aria-label="Create new"
        >
          +
        </button>
        {menuOpen && (
          <div style={fabMenuStyle}>
            <Link href="/jobs/new" style={fabMenuItemStyle} onClick={() => setMenuOpen(false)}>
              📝 New quote
            </Link>
            <Link
              href="/calendar/quick-book"
              style={fabMenuItemStyle}
              onClick={() => setMenuOpen(false)}
            >
              🔧 Quick book a job
            </Link>
            <Link
              href="/calendar/reminder/new"
              style={fabMenuItemStyle}
              onClick={() => setMenuOpen(false)}
            >
              📌 Personal reminder
            </Link>
            <Link
              href="/jobs/recurring/new"
              style={fabMenuItemStyle}
              onClick={() => setMenuOpen(false)}
            >
              🔁 Recurring job
            </Link>
          </div>
        )}
      </div>

      <nav style={navStyle}>
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                ...navItemStyle,
                color: active ? "#111" : "#999",
                fontWeight: active ? 700 : 500,
              }}
            >
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 11 }}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.15)",
  zIndex: 15,
};

const navStyle = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: "white",
  borderTop: "1px solid #eee",
  display: "flex",
  justifyContent: "space-around",
  padding: "10px 0",
  zIndex: 10,
};

const navItemStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  textDecoration: "none",
  minWidth: 60,
};

const fabWrapperStyle = {
  position: "fixed",
  bottom: 62,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 20,
};

const fabButtonStyle = {
  cursor: "pointer",
  width: 56,
  height: 56,
  borderRadius: 28,
  background: "#111",
  color: "white",
  fontSize: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
  border: "3px solid #f6f7f9",
  boxSizing: "border-box",
  padding: 0,
};

const fabMenuStyle = {
  position: "absolute",
  bottom: 66,
  left: "50%",
  transform: "translateX(-50%)",
  background: "white",
  borderRadius: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  width: 220,
};

const fabMenuItemStyle = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: "#111",
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: "nowrap",
};
