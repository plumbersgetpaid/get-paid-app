const LOCALE_BY_CURRENCY = {
  GBP: "en-GB",
  USD: "en-US",
  EUR: "en-IE", // gives a clean "€1,234.56" rather than symbol-after formats
};

export function formatCurrency(amount, currencyCode = "GBP") {
  const locale = LOCALE_BY_CURRENCY[currencyCode] || "en-GB";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode || "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch (e) {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

// The number for a {{amount}} template placeholder: formatted like money
// ("1,880.40" - always two decimals, thousands separators) but WITHOUT the
// currency symbol, because the templates write the "£" themselves
// ("£{{amount}}"). Passing a raw number here is what produced "£1880.4" in
// a customer email - always use this for template amount vars.
export function formatAmountForTemplate(amount, currencyCode = "GBP") {
  return formatCurrency(amount, currencyCode).replace(/^[^\d-]*/, "");
}

// A date for customer-facing email text: "25 August 2026". Pinned to UTC
// because date-only values parse as UTC midnight - without it a server
// timezone change would shift dates by a day.
export function formatDateForEmail(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Formats an invoice's auto-incrementing number as e.g. "INV-0007"
export function formatInvoiceNumber(n) {
  if (n === undefined || n === null) return "";
  return `INV-${String(n).padStart(4, "0")}`;
}
