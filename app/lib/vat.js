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
