// VAT breakdown helper - the ONE place the arithmetic lives.
//
// The app's amounts are always VAT-INCLUSIVE totals (that's how trades quote
// homeowners). For a VAT-registered business the breakdown is derived from
// the total: net = total / (1 + rate/100), vat = total - net. Rounded to
// pennies with the net as the remainder so the three lines always add up
// exactly (net + vat = total, to the penny).
//
// An invoice row carries its own vat_rate/vat_number snapshot from creation;
// always prefer the snapshot over current settings when displaying an
// existing invoice, so old invoices never change retroactively.
export function vatBreakdown(total, rate) {
  const gross = Number(total);
  const r = Number(rate);
  if (!Number.isFinite(gross) || !Number.isFinite(r) || r <= 0) return null;
  const vat = Math.round(((gross * r) / (100 + r)) * 100) / 100;
  const net = Math.round((gross - vat) * 100) / 100;
  return { net, vat, gross, rate: r };
}

// "£500 + VAT" -> £600. Used at PRICE-ENTRY time for businesses whose
// vat_price_entry setting is 'exclusive' (they quote before-VAT, commercial
// style). Storage stays gross everywhere - this converts once, on the way in.
export function grossUp(net, rate) {
  const n = Number(net);
  const r = Number(rate);
  if (!Number.isFinite(n)) return n;
  if (!Number.isFinite(r) || r <= 0) return n;
  return Math.round(n * (1 + r / 100) * 100) / 100;
}

// The stored gross shown back as a before-VAT figure (edit-form prefills in
// exclusive mode, so a resubmitted unchanged form round-trips to the same
// gross rather than getting VAT added twice).
export function netOf(gross, rate) {
  const v = vatBreakdown(gross, rate);
  return v ? v.net : Number(gross);
}

// Converts a typed price to the stored gross according to the business's
// entry mode. Empty/invalid input is returned untouched so callers keep
// their own "was anything entered?" logic.
export function toStoredAmount(entered, settings) {
  const n = parseFloat(entered);
  if (!Number.isFinite(n)) return entered;
  if (settings?.vat_registered && settings?.vat_price_entry === "exclusive") {
    return grossUp(n, settings.vat_rate ?? 20);
  }
  return n;
}
