"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Mirrors the server-side date logic in calendar/page.jsx exactly, so
// jumping to a picked date always lands on a range that actually
// contains it - tested against 12 cases (including week/month/year
// boundaries) before this went anywhere near the real calendar.

function ymdToUTCDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function computeOffset(range, todayStr, pickedStr) {
  const today = ymdToUTCDate(todayStr);
  const picked = ymdToUTCDate(pickedStr);

  if (range === "today") {
    return Math.round((picked - today) / (1000 * 60 * 60 * 24));
  }

  if (range === "week") {
    const todayDow = today.getUTCDay();
    const todayMonday = new Date(today);
    todayMonday.setUTCDate(today.getUTCDate() + (todayDow === 0 ? -6 : 1 - todayDow));

    const pickedDow = picked.getUTCDay();
    const pickedMonday = new Date(picked);
    pickedMonday.setUTCDate(picked.getUTCDate() + (pickedDow === 0 ? -6 : 1 - pickedDow));

    const diffDays = Math.round((pickedMonday - todayMonday) / (1000 * 60 * 60 * 24));
    return Math.round(diffDays / 7);
  }

  return (
    (picked.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (picked.getUTCMonth() - today.getUTCMonth())
  );
}

export default function DateJump({ range, todayStr }) {
  const router = useRouter();
  // This input is uncontrolled (no value prop) since it always resets
  // to empty once the page navigates away - this just tracks whether
  // to show the dd/mm/yyyy hint, separately from the input's own value
  const [isEmpty, setIsEmpty] = useState(true);
  // Only touch-primary devices get the custom hint - desktop already
  // renders its own dd/mm/yyyy natively, so showing both at once was
  // stacking two copies on top of each other
  const [showCustomHint, setShowCustomHint] = useState(false);

  useEffect(() => {
    setShowCustomHint(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);

  function handleChange(e) {
    const picked = e.target.value;
    setIsEmpty(!picked);
    if (!picked) return;
    const offset = computeOffset(range, todayStr, picked);
    router.push(`/calendar?range=${range}&offset=${offset}`);
  }

  return (
    <div style={wrapperStyle}>
      <input
        type="date"
        onChange={handleChange}
        aria-label="Jump to date"
        style={dateJumpStyle}
      />
      {showCustomHint && isEmpty && <span style={hintStyle}>dd/mm/yyyy</span>}
    </div>
  );
}

const wrapperStyle = {
  position: "relative",
};

const dateJumpStyle = {
  padding: "10px 12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 13,
  minWidth: 0,
  background: "white",
  color: "#000",
};

const hintStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#767676",
  fontSize: 13,
  pointerEvents: "none",
  zIndex: 1,
};
