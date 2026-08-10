// Converts a plain-text message body into safe HTML for an email: escapes
// HTML-sensitive characters, turns any http(s) URLs into real clickable
// links, and converts line breaks. Used everywhere a template-rendered
// message gets sent via Resend, so links like a Google review link always
// render as tappable links rather than plain text.
export function textToEmailHtml(text) {
  const escaped = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color:#2563eb;">${url}</a>`
  );

  return linked.replace(/\n/g, "<br/>");
}
