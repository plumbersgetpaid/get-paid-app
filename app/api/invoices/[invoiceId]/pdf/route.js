import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../../lib/getBusinessSettings";
import { formatInvoiceNumber } from "../../../../lib/formatCurrency";
import { getJobPhotosForPdf } from "../../../../lib/getJobPhotosForPdf";

export async function GET(req, { params }) {
  const { invoiceId } = params;
  const db = supabaseAdmin();

  const { data: invoice, error } = await db
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return new Response(JSON.stringify({ error: "Invoice not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: job } = await db
    .from("jobs")
    .select("*")
    .eq("id", invoice.job_id)
    .single();

  const { data: customer } = job?.customer_id
    ? await db.from("customers").select("*").eq("id", job.customer_id).single()
    : { data: null };

  const settings = await getBusinessSettings();
  const { beforePhotos, afterPhotos } = await getJobPhotosForPdf(db, job?.id);
  const business = {
    businessName: settings.business_name,
    accentColor: settings.accent_color,
    logoUrl: settings.logo_url,
    contactEmail: settings.contact_email,
    contactPhone: settings.contact_phone,
    invoiceNote: settings.invoice_note,
    headerTagline: settings.header_tagline,
    paymentTerms: settings.payment_terms,
    bankDetails: settings.bank_details,
    currency: settings.currency,
    beforePhotos,
    afterPhotos,
  };

  const pdfBytes = await generateInvoicePdfBytes({
    invoiceNumber: formatInvoiceNumber(invoice.invoice_number),
    customerName: customer?.name,
    customerEmail: customer?.email,
    customerPhone: customer?.phone,
    jobType: job?.job_type,
    location: job?.location,
    amount: invoice.amount,
    dueDate: invoice.due_date,
    status: invoice.status,
    paidAt: invoice.paid_at,
    createdAt: invoice.created_at,
    paymentLink: invoice.payment_link || undefined,
    business,
  });

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${formatInvoiceNumber(
        invoice.invoice_number
      )}.pdf"`,
    },
  });
}
