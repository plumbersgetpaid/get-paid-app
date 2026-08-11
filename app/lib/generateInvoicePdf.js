import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from "pdf-lib";
import { formatCurrency } from "./formatCurrency";

// Adds a real clickable link annotation over a rectangle on the page -
// pdf-lib has no high-level helper for this, so it's built directly from
// the PDF spec's link annotation dictionary.
function addLinkAnnotation(pdfDoc, page, url, x, y, width, height) {
  const annotation = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(url),
    },
  });
  const annotationRef = pdfDoc.context.register(annotation);
  const existingAnnots = page.node.lookup(PDFName.of("Annots"));
  if (existingAnnots) {
    existingAnnots.push(annotationRef);
  } else {
    page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotationRef]));
  }
}

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
// contactEmail, contactPhone, invoiceNote, headerTagline, paymentTerms,
// bankDetails, currency } - all optional.
export async function generateInvoicePdfBytes({
  invoiceNumber,
  customerName,
  customerEmail,
  customerPhone,
  jobType,
  location,
  amount,
  dueDate,
  status,
  paidAt,
  createdAt,
  quotedAmount,
  priceChangeNote,
  paymentLink,
  paymentNote,
  business = {},
}) {
  const {
    businessName,
    accentColor,
    logoUrl,
    contactEmail,
    contactPhone,
    invoiceNote,
    headerTagline,
    paymentTerms,
    bankDetails,
    currency,
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
    y -= 18;
  }
  if (headerTagline) {
    page.drawText(headerTagline, { x: left, y, size: 10, font, color: grey });
    y -= 16;
  }
  y -= 8;

  page.drawText("Invoice", { x: left, y, size: 24, font: bold });
  y -= 24;

  const meta = [
    invoiceNumber ? `Invoice #${invoiceNumber}` : null,
    createdAt ? new Date(createdAt).toLocaleDateString("en-GB") : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
  if (meta) {
    page.drawText(meta, { x: left, y, size: 10, font, color: grey });
  }
  y -= 14;

  // A clean divider under the header, so the letterhead doesn't run
  // straight into the customer details
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });
  y -= 30;

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
  if (location) {
    page.drawText(location, { x: left, y, size: 10, font, color: grey });
    y -= 14;
  }
  y -= 16;

  // Right-aligns text so it lines up on a clean edge regardless of how
  // many digits/characters it has - the actual bug behind the "Amount"
  // and "Due date" values not lining up was that they were each nudged in
  // from the right by a different arbitrary amount
  const drawRightAligned = (text, yPos, size, useFont, color) => {
    const str = String(text ?? "");
    const textWidth = useFont.widthOfTextAtSize(str, size);
    page.drawText(str, { x: right - textWidth, y: yPos, size, font: useFont, color });
  };

  page.drawText("Description", { x: left, y, size: 10, font: bold, color: grey });
  drawRightAligned("Amount", y, 10, bold, grey);
  y -= 8;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: accent,
  });
  y -= 22;

  page.drawText(jobType || "Plumbing work", { x: left, y, size: 12, font });
  drawRightAligned(formatCurrency(amount, currency), y, 12, font);
  y -= 20;

  // If the final price differs from the original quote, make that clear on
  // the invoice itself, along with any explanation the tradie gave
  const priceChanged =
    quotedAmount !== undefined &&
    quotedAmount !== null &&
    Math.abs(Number(quotedAmount) - Number(amount)) > 0.001;

  if (priceChanged) {
    page.drawText(
      `Originally quoted ${formatCurrency(quotedAmount, currency)} - adjusted to reflect the work carried out`,
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

  // A real, tappable "Pay now" button, if the tradie added a payment link
  // for this invoice - sits alongside the bank details below, never
  // replacing them, so the customer can use whichever they prefer
  if (paymentLink) {
    const buttonWidth = 160;
    const buttonHeight = 30;
    const buttonX = left;
    const buttonY = y - buttonHeight + 8;

    page.drawRectangle({
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      color: accent,
    });
    const buttonLabel = "Pay now";
    const labelWidth = bold.widthOfTextAtSize(buttonLabel, 12);
    page.drawText(buttonLabel, {
      x: buttonX + (buttonWidth - labelWidth) / 2,
      y: buttonY + 10,
      size: 12,
      font: bold,
      color: rgb(1, 1, 1),
    });
    addLinkAnnotation(pdfDoc, page, paymentLink, buttonX, buttonY, buttonWidth, buttonHeight);

    y = buttonY - 16;

    if (paymentNote) {
      page.drawText(paymentNote, { x: left, y, size: 8, font, color: grey });
      y -= 16;
    }
  }

  const row = (label, value) => {
    page.drawText(label, { x: left, y, size: 10, font, color: grey });
    drawRightAligned(value, y, 10, font);
    y -= 16;
  };

  row("Due date", dueDate);
  if (paidAt) {
    row("Paid on", new Date(paidAt).toLocaleDateString("en-GB"));
  }

  // Footer: custom note, payment terms, bank details, then contact line,
  // pinned near the bottom. Each field can be multiple lines (e.g. sort
  // code on one line, account number on the next).
  const drawFooterBlock = (text, startY) => {
    let currentY = startY;
    for (const line of text.split("\n")) {
      if (line.trim()) {
        page.drawText(line, { x: left, y: currentY, size: 9, font, color: grey });
      }
      currentY -= 13;
    }
    return currentY;
  };

  let footerY = 130;
  if (invoiceNote) {
    footerY = drawFooterBlock(invoiceNote, footerY);
  }
  if (paymentTerms) {
    footerY = drawFooterBlock(paymentTerms, footerY);
  }
  if (bankDetails) {
    footerY = drawFooterBlock(bankDetails, footerY);
  }
  const contactLine = [contactEmail, contactPhone].filter(Boolean).join(" \u00b7 ");
  if (contactLine) {
    page.drawText(contactLine, { x: left, y: footerY, size: 9, font, color: grey });
  }

  // Before/after photos, if the tradie chose to include them - added as
  // extra pages so the invoice stays permanently viewable with its photo
  // record, however many photos there are
  const beforePhotos = business.beforePhotos || [];
  const afterPhotos = business.afterPhotos || [];

  if (beforePhotos.length > 0 || afterPhotos.length > 0) {
    await drawPhotoSections(pdfDoc, font, bold, grey, left, right, [
      { label: "Before", urls: beforePhotos },
      { label: "After", urls: afterPhotos },
    ]);
  }

  return await pdfDoc.save();
}

// Lays out one or more labelled photo sections (e.g. "Before" / "After")
// across as many extra A4 pages as needed, in a simple 2-column grid.
async function drawPhotoSections(pdfDoc, font, bold, grey, left, right, sections) {
  const thumbWidth = 220;
  const thumbHeight = 160;
  const gap = 15;
  const topMargin = 800;
  const bottomMargin = 60;

  const embedImage = async (url) => {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    return contentType.includes("png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  };

  // Fetch and embed every photo at once, in parallel - this is the slow,
  // network-bound part. Laying them out on the page afterwards is fast and
  // has to happen in order regardless.
  const sectionsWithImages = await Promise.all(
    sections
      .filter((s) => s.urls.length > 0)
      .map(async (s) => ({
        label: s.label,
        images: await Promise.all(
          s.urls.map(async (url) => {
            try {
              return await embedImage(url);
            } catch (e) {
              console.error("Could not embed a job photo in PDF:", e);
              return null;
            }
          })
        ),
      }))
  );

  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = topMargin;
  let col = 0;

  const ensureRoom = (neededHeight) => {
    if (y - neededHeight < bottomMargin) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = topMargin;
      col = 0;
    }
  };

  for (const section of sectionsWithImages) {
    ensureRoom(30);
    page.drawText(section.label, { x: left, y, size: 14, font: bold });
    y -= 26;
    col = 0;

    for (const image of section.images) {
      if (!image) continue;

      ensureRoom(thumbHeight + gap);

      const scale = Math.min(thumbWidth / image.width, thumbHeight / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      const x = left + col * (thumbWidth + gap);
      page.drawImage(image, { x, y: y - h, width: w, height: h });

      col += 1;
      if (col >= 2) {
        col = 0;
        y -= thumbHeight + gap;
      }
    }

    if (col !== 0) {
      y -= thumbHeight + gap;
    }
    y -= 10;
  }
}
