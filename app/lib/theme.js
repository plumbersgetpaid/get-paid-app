import { Poppins, IBM_Plex_Mono } from "next/font/google";

// ---------------------------------------------------------------
// The app's shared visual language, defined once.
//
// Everything here is derived from the marketing site, so the two
// read as the same product. Before this file existed, every screen
// re-declared its own cardStyle, its own heading sizes, its own
// colours - which is why a restyle meant editing 60-odd files. New
// screens should pull from here rather than inventing their own.
// ---------------------------------------------------------------

// Poppins is the brand guide's documented match for the logo wordmark.
// 300 for large display text, 400/500 for everything else.
// Every weight the app actually uses has to be listed here. Miss one
// and the browser fakes it, which renders inconsistently between
// screens and is exactly what makes two headings in the same typeface
// look like two different fonts.
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

// Mono is for data specifically - times, prices, dates, invoice
// numbers, counts. Not decoration: figures set in a monospace face
// line up down a column and are quicker to scan, which is the whole
// job of most of these screens.
export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

// ---------------------------------------------------------------
// Colour
// ---------------------------------------------------------------
export const c = {
  ink: "#000000",
  paper: "#ffffff",
  surface: "#f6f7f9",
  mid: "#6b6b6b",
  line: "#e2e2e2",
  hairline: "#eeeeee",
  // Status colours carry meaning, so they stay put. Never used
  // decoratively - if something is red here, it's late.
  red: "#dc2626",
  green: "#16a34a",
  amber: "#d97706",
  blue: "#2563eb",
  purple: "#9333ea",
};

// ---------------------------------------------------------------
// The metallic treatment
//
// Deliberately rationed. Silver marks the product itself - the
// wordmark, the create button, the active tab - never status or
// data. Keeping it scarce is what stops it looking like 2010.
// ---------------------------------------------------------------
export const metallicTitleStyle = {
  backgroundImage: "linear-gradient(120deg, #2b2b2b, #6b6b6b, #1a1a1a, #555555, #111111)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export const silverAccentStyle = {
  backgroundImage:
    "linear-gradient(180deg, #f4f4f4 0%, #b8b8b8 25%, #e8e8e8 50%, #909090 75%, #d4d4d4 100%)",
};

// Richer, angled version for surfaces big enough to show it -
// the create button and the header icons.
export const silverSurfaceStyle = {
  backgroundImage:
    "linear-gradient(140deg, #ffffff 0%, #b0b0b0 22%, #f4f4f4 46%, #8a8a8a 68%, #dedede 88%, #a4a4a4 100%)",
};

// ---------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------

// Crisp border rather than a drop shadow, small radius rather than
// a soft one - matches the boxes on the marketing site.
export const cardStyle = {
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 3,
  padding: 16,
  marginTop: 14,
};

// Small mono caps, the same device the site uses above each section.
export const sectionLabelStyle = {
  fontSize: 10.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: c.mid,
  marginBottom: 4,
};

// For figures: prices, times, dates, counts.
export const dataStyle = {
  letterSpacing: "0.03em",
};

export const bigNumberStyle = {
  fontWeight: 300,
  fontSize: 40,
  letterSpacing: "-0.04em",
  lineHeight: 1,
};

export const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "12px 0",
  borderTop: `1px solid ${c.hairline}`,
  fontSize: 14.5,
};

// Primary actions stay black. Silver was tried here and read as
// weaker than black against a white secondary button - on a screen
// where you're choosing between two actions, contrast matters more
// than finish.
export const primaryButtonStyle = {
  background: c.ink,
  color: c.paper,
  border: "none",
  borderRadius: 2,
  padding: "12px 16px",
  fontWeight: 500,
  fontSize: 13.5,
};

export const quietButtonStyle = {
  background: c.paper,
  color: c.ink,
  border: `1px solid ${c.line}`,
  borderRadius: 2,
  padding: "12px 16px",
  fontWeight: 500,
  fontSize: 13.5,
};

export const linkStyle = {
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: c.mid,
  textDecoration: "none",
  marginTop: 14,
  display: "inline-block",
};

// The small coloured bar that flags status on a row. Flat, not
// metallic - at 4px wide a gradient just muddies the colour, and
// keeping silver exclusive to branding means a coloured bar always
// means "this needs doing".
export function statusBarStyle(colour) {
  return {
    width: 4,
    height: 20,
    borderRadius: 2,
    flexShrink: 0,
    background: colour,
  };
}
