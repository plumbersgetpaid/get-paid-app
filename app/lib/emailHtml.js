// Converts a plain-text message body into safe HTML for an email: escapes
// HTML-sensitive characters, turns any http(s) URLs into real clickable
// links, and converts line breaks. Used everywhere a template-rendered
// message gets sent via Resend, so links like a Google review link always
// render as tappable links rather than plain text.
export function textToEmailHtml(text) {
  // Normalise spacing so every email reads symmetrically regardless of how
  // templates or user-entered blocks (bank details etc.) were typed:
  // trailing spaces stripped per line, runs of 3+ blank-line breaks
  // collapsed to one blank line, outer whitespace trimmed.
  const normalised = String(text || "")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const escaped = normalised
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color:#2563eb;">${url}</a>`
  );

  return linked.replace(/\n/g, "<br/>");
}
