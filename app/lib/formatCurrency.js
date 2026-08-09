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

// Formats an invoice's auto-incrementing number as e.g. "INV-0007"
export function formatInvoiceNumber(n) {
  if (n === undefined || n === null) return "";
  return `INV-${String(n).padStart(4, "0")}`;
}
