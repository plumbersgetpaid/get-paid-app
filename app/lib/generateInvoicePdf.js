import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Renders a single-page A4 PDF invoice from plain field values (not DB rows
// directly), so this can be reused for emailing, single downloads, and
// bulk/multi-page downloads without re-fetching data in a fixed shape.
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
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.45, 0.45, 0.45);
  const left = 50;
  const right = 545;
  let y = 780;

  page.drawText("Invoice", { x: left, y, size: 24, font: bold });
  y -= 22;

  const meta = [
    invoiceIdShort ? `Invoice #${invoiceIdShort}` : null,
    createdAt ? new Date(createdAt).toLocaleDateString("en-GB") : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
  if (meta) {
    page.drawText(meta, { x: left, y, size: 10, font, color: grey });
  }
  y -= 40;

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
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 22;

  page.drawText(jobType || "Plumbing work", { x: left, y, size: 12, font });
  page.drawText(`£${Number(amount).toFixed(2)}`, { x: right - 90, y, size: 12, font });
  y -= 20;
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

  return await pdfDoc.save();
}
