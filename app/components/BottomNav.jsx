"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { c, silverAccentStyle, silverSurfaceStyle } from "../lib/theme";

export default function BottomNav({
  canCreateQuote,
  canCreateJob,
  canCreateRecurringJob,
  canSeeClientDatabase,
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Built here, not as a static module-level constant, since Clients
  // needs to disappear entirely for anyone without can_see_client_database
  // - a specific subcontractor can now have this turned off, and leaving
  // the tab visible but leading to a dead end (a bare "page not found")
  // is worse than not showing it as an option at all
  const TABS = [
    { href: "/", icon: "home", label: "Today" },
    { href: "/work", icon: "work", label: "Work" },
    { href: "/calendar", icon: "calendar", label: "Calendar" },
    ...(canSeeClientDatabase ? [{ href: "/clients", icon: "person", label: "Clients" }] : []),
  ];

  // The nav lives in the shared layout, which doesn't unmount between page
  // navigations - so close the menu explicitly whenever the route changes,
  // as a safety net alongside the explicit close-on-click handlers below.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // The login and setup pages shouldn't show the rest of the app's
  // navigation at all - seeing "Work", "Calendar" etc still reachable
  // from what's meant to be a logged-out screen is confusing, even though
  // those pages aren't actually behind any login check yet themselves
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms")
  ) {
    return null;
  }

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
          <Icon name="plus" size={26} color="#000" strokeWidth={1.6} />
        </button>
        {menuOpen && (
          <div style={fabMenuStyle}>
            {canCreateQuote && (
              <Link href="/jobs/new" style={fabMenuItemStyle} onClick={() => setMenuOpen(false)}>
                <Icon name="doc" size={17} />
                New quote
              </Link>
            )}
            {canCreateJob && (
              <Link
                href="/calendar/quick-book"
                style={fabMenuItemStyle}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="job" size={17} />
                Quick book a job
              </Link>
            )}
            <Link
              href="/calendar/reminder/new"
              style={fabMenuItemStyle}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="pin" size={17} />
              Personal reminder
            </Link>
            {canCreateRecurringJob && (
              <Link
                href="/jobs/recurring/new"
                style={fabMenuItemStyle}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="repeat" size={17} />
                Recurring job
              </Link>
            )}
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
                color: active ? c.ink : "#9a9a9a",
                fontWeight: active ? 500 : 400,
              }}
            >
              <Icon name={tab.icon} size={19} strokeWidth={active ? 1.9 : 1.6} />
              <span style={{ fontSize: 10.5 }}>{tab.label}</span>
              {/* Silver only marks where you are - it never carries
                  status or data anywhere in the app */}
              <span
                style={{
                  ...tabMarkStyle,
                  ...(active ? silverAccentStyle : {}),
                  visibility: active ? "visible" : "hidden",
                }}
              />
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
  borderTop: `1px solid ${c.hairline}`,
  display: "flex",
  justifyContent: "space-around",
  // Extra bottom padding for the iPhone home indicator (safe-area inset);
  // falls back to the plain 11px where there's no inset.
  padding: "9px 0 calc(11px + env(safe-area-inset-bottom, 0px))",
  zIndex: 10,
};

const navItemStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  textDecoration: "none",
  minWidth: 60,
};

const tabMarkStyle = {
  width: 20,
  height: 3,
  borderRadius: 2,
  marginTop: 2,
};

const fabWrapperStyle = {
  position: "fixed",
  bottom: 60,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 20,
};

const fabButtonStyle = {
  cursor: "pointer",
  width: 54,
  height: 54,
  borderRadius: 27,
  ...silverSurfaceStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
  border: `3px solid ${c.surface}`,
  boxSizing: "border-box",
  padding: 0,
};

const fabMenuStyle = {
  position: "absolute",
  bottom: 66,
  left: "50%",
  transform: "translateX(-50%)",
  background: "white",
  border: `1px solid ${c.line}`,
  borderRadius: 3,
  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
  padding: 6,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  width: 230,
};

const fabMenuItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 12px",
  borderRadius: 2,
  textDecoration: "none",
  color: c.ink,
  fontSize: 14,
  fontWeight: 400,
  whiteSpace: "nowrap",
};
