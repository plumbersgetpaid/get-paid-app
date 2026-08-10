"use client";

import { useEffect, useState } from "react";

// Reads the device's own clock (not the server's), so the greeting always
// matches whatever time it actually is for the person looking at the screen
export default function Greeting() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    const text = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const date = now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    setInfo({ text, date });
  }, []);

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{info ? info.text : "Hello"} 👋</div>
      <div style={{ fontSize: 14, color: "#888" }}>{info ? info.date : ""}</div>
    </div>
  );
}
