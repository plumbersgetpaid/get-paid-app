import { Poppins } from "next/font/google";

// Loaded once, shared by every page title that wants the branded
// treatment (Work, Calendar, Clients, Good Morning) - Poppins Light is
// the brand guide's own documented match for the logo's wordmark
// typeface, so Bold here is the same family, just a heavier cut
// specifically because a thin stroke doesn't give the gradient below
// enough surface area to actually read as a sheen at this text size.
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

// The metallic/brushed-steel effect used on branded titles. Spread
// across a real range of tones (not just two colours) so the gradient
// reads as a sheen rather than a flat colour - visually confirmed
// against three other variants before landing on this one specifically
// for actually looking metallic at a 20-22px title size, where subtler
// gradients just read as slightly-textured black.
export const metallicTitleStyle = {
  backgroundImage: "linear-gradient(120deg, #2b2b2b, #6b6b6b, #1a1a1a, #555555, #111111)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};
