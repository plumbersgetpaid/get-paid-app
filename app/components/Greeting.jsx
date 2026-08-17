"use client";

import { useEffect, useState } from "react";
import { poppins, metallicTitleStyle, silverAccentStyle } from "../lib/fonts";

// Reads the device's own clock (not the server's), so the greeting always
// matches whatever time it actually is for the person looking at the screen
export default function Greeting() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    const text = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
    const date = now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    setInfo({ text, date });
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 6, height: 24, borderRadius: 3, flexShrink: 0, ...silverAccentStyle }} />
      <div>
        <span className={poppins.className} style={{ ...metallicTitleStyle, fontSize: 22 }}>
          {info ? info.text : "Hello"}
        </span>{" "}
        <span style={{ fontSize: 22 }}>👋</span>
        <div style={{ fontSize: 14, color: "#888" }}>{info ? info.date : ""}</div>
      </div>
    </div>
  );
}
