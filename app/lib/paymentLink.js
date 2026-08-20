// Payment links are emailed to homeowners as a "Pay now" button and baked
// into the invoice PDF - so they must be real http(s) URLs, never an
// arbitrary string (a "javascript:" or lookalike-text value would be a
// payment-diversion phishing vector sent under the business's own name).
// Returns the normalised URL string, or null if the input isn't acceptable.
export function sanitizePaymentLink(input) {
  const raw = (input || "").toString().trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}
