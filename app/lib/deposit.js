import { formatCurrency } from "./formatCurrency";

// Shared deposit parsing/validation for the routes that create jobs.
//
// The deposit is the literal £ the customer will be asked to send (no VAT
// arithmetic - it's a payment, not a price). Valid only when the tick box
// was on, the amount is a positive number, and it's LESS than the job's
// stored (gross) total - a "deposit" of the whole job or more is a mistake,
// not a deposit. Returns a number, or null when no valid deposit was asked.
export function parseDeposit(form, grossTotal) {
  if (form.get("askDeposit") !== "1") return null;
  const dep = parseFloat((form.get("depositAmount") || "").toString().trim());
  if (!Number.isFinite(dep) || dep <= 0) return null;
  const total = Number(grossTotal);
  if (Number.isFinite(total) && total > 0 && dep >= total) return null;
  return Math.round(dep * 100) / 100;
}

// The received-on date printed on the final invoice: "14 August 2026".
// date-only column, so pin UTC (parses as UTC midnight).
export function formatDepositDate(value) {
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

// The "how to pay" block appended to deposit request/reminder emails -
// bank details from settings, since there's no invoice (and so no payment
// link) yet at deposit time.
export function depositHowToPay(settings) {
  if (!settings?.bank_details) return "";
  return `\n\nHow to pay:\n${settings.bank_details}`;
}

export function formatDepositLine(amount, currency) {
  return formatCurrency(amount, currency);
}
