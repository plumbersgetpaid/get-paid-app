import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Converts a hex colour like "#111111" into pdf-lib's 0-1 rgb() format.
// Falls back to near-black if the value is missing or malformed.
function hexToRgb(hex) {
  const fallback = rgb(0.07, 0.07, 0.07);
  if (!hex || typeof hex !== "string") return fallback;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return fallback;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return fallback;
  return rgb(r, g, b);
}

// Renders a single-page A4 PDF invoice from plain field values (not DB rows
// directly), so this can be reused for emailing, single downloads, and
// bulk/multi-page downloads without re-fetching data in a fixed shape.
//
// `business` carries the branding: { businessName, accentColor, logoUrl,
// contactEmail, contactPhone, invoiceNote } - all optional.
export async function generateInvoicePdfBytes({
  invoiceIdShort,
  customerName,
  customerEmail,
  customerPhone,
  jobType,
  amount,
  dueDate,
  status,
  paidAt,
  createdAt,
  quotedAmount,
  priceChangeNote,
  business = {},
}) {
  const {
    businessName,
    accentColor,
    logoUrl,
    contactEmail,
    contactPhone,
    invoiceNote,
  } = business;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.45, 0.45, 0.45);
  const accent = hexToRgb(accentColor);
  const left = 50;
  const right = 545;
  let y = 780;

  // Optional logo, top-right corner
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      const contentType = res.headers.get("content-type") || "";
      const bytes = new Uint8Array(await res.arrayBuffer());
      const image = contentType.includes("png")
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);
      const maxWidth = 100;
      const maxHeight = 50;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: right - w, y: 800 - h, width: w, height: h });
    } catch (e) {
      // Logo is optional - if it fails to load, just skip it silently
      console.error("Could not embed logo in PDF:", e);
    }
  }

  if (businessName) {
    page.drawText(businessName, { x: left, y, size: 14, font: bold, color: accent });
    y -= 22;
  }

  page.drawText("Invoice", { x: left, y, size: 22, font: bold });
  y -= 20;

  const meta = [
    invoiceIdShort ? `Invoice #${invoiceIdShort}` : null,
    createdAt ? new Date(createdAt).toLocaleDateString("en-GB") : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
  if (meta) {
    page.drawText(meta, { x: left, y, size: 10, font, color: grey });
  }
  y -= 36;

  page.drawText(customerName || "Customer", { x: left, y, size: 13, font: bold });
  y -= 16;
  if (customerEmail) {
    page.drawText(customerEmail, { x: left, y, size: 10, font, color: grey });
    y -= 14;
  }
  if (customerPhone) {
    page.drawText(customerPhone, { x: left, y, size: 10, font, color: grey });
    y -= 14;
  }
  y -= 20;

  page.drawText("Description", { x: left, y, size: 10, font: bold, color: grey });
  page.drawText("Amount", { x: right - 60, y, size: 10, font: bold, color: grey });
  y -= 8;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: accent,
  });
  y -= 22;

  page.drawText(jobType || "Plumbing work", { x: left, y, size: 12, font });
  page.drawText(`£${Number(amount).toFixed(2)}`, { x: right - 90, y, size: 12, font });
  y -= 20;

  // If the final price differs from the original quote, make that clear on
  // the invoice itself, along with any explanation the tradie gave
  const priceChanged =
    quotedAmount !== undefined &&
    quotedAmount !== null &&
    Math.abs(Number(quotedAmount) - Number(amount)) > 0.001;

  if (priceChanged) {
    page.drawText(
      `Originally quoted £${Number(quotedAmount).toFixed(2)} - adjusted to reflect the work carried out`,
      { x: left, y, size: 9, font, color: grey }
    );
    y -= 14;

    if (priceChangeNote) {
      // Simple manual word-wrap since pdf-lib doesn't wrap text for us
      const maxCharsPerLine = 95;
      const words = priceChangeNote.split(" ");
      let line = "";
      const lines = [];
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > maxCharsPerLine) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);

      for (const l of lines.slice(0, 3)) {
        page.drawText(l, { x: left, y, size: 9, font, color: grey });
        y -= 13;
      }
    }
  }

  y -= 8;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 26;

  const row = (label, value) => {
    page.drawText(label, { x: left, y, size: 10, font, color: grey });
    page.drawText(String(value ?? ""), { x: right - 120, y, size: 10, font });
    y -= 16;
  };

  row("Due date", dueDate);
  row("Status", status);
  if (paidAt) {
    row("Paid on", new Date(paidAt).toLocaleDateString("en-GB"));
  }

  // Footer: custom note + contact details, pinned near the bottom
  let footerY = 90;
  if (invoiceNote) {
    page.drawText(invoiceNote, { x: left, y: footerY, size: 9, font, color: grey });
    footerY -= 14;
  }
  const contactLine = [contactEmail, contactPhone].filter(Boolean).join(" \u00b7 ");
  if (contactLine) {
    page.drawText(contactLine, { x: left, y: footerY, size: 9, font, color: grey });
  }

  return await pdfDoc.save();
}
