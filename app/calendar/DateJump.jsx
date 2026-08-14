"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  const [isEmpty, setIsEmpty] = useState(true);
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
      {showCustomHint && isEmpty && (
        <span style={hintStyle}>
          <span>dd/mm/yyyy</span>
          <span>📅</span>
        </span>
      )}
    </div>
  );
}

const wrapperStyle = {
  position: "relative",
};

const dateJumpStyle = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 13,
  minWidth: 0,
  background: "white",
  color: "#111",
};

const hintStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 13px 0 12px",
  color: "#767676",
  fontSize: 13,
  pointerEvents: "none",
  zIndex: 1,
};
