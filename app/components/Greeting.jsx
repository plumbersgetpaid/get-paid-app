"use client";

import { useEffect, useState } from "react";
import { poppins, mono, metallicTitleStyle, silverAccentStyle } from "../lib/theme";

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
      <div style={{ width: 6, height: 26, borderRadius: 2, flexShrink: 0, ...silverAccentStyle }} />
      <div>
        <span className={poppins.className} style={{ ...metallicTitleStyle, fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em" }}>
          {info ? info.text : "Hello"}
        </span>

        <div className={mono.className} style={dateStyle}>
          {info ? info.date.toUpperCase() : ""}
        </div>
      </div>
    </div>
  );
}

const dateStyle = {
  fontSize: 11,
  color: "#6b6b6b",
  letterSpacing: "0.04em",
  marginTop: 3,
};
