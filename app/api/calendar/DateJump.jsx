"use client";

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

  function handleChange(e) {
    const picked = e.target.value;
    if (!picked) return;
    const offset = computeOffset(range, todayStr, picked);
    router.push(`/calendar?range=${range}&offset=${offset}`);
  }

  return (
    <input
      type="date"
      onChange={handleChange}
      aria-label="Jump to date"
      style={dateJumpStyle}
    />
  );
}

const dateJumpStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 13,
  minWidth: 0,
  background: "white",
  color: "#111",
};
