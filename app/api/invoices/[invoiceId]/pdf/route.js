import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../../lib/getBusinessSettings";

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
  const business = {
    businessName: settings.business_name,
    accentColor: settings.accent_color,
    logoUrl: settings.logo_url,
    contactEmail: settings.contact_email,
    contactPhone: settings.contact_phone,
    invoiceNote: settings.invoice_note,
  };

  const pdfBytes = await generateInvoicePdfBytes({
    invoiceIdShort: invoice.id.slice(0, 8).toUpperCase(),
    customerName: customer?.name,
    customerEmail: customer?.email,
    customerPhone: customer?.phone,
    jobType: job?.job_type,
    amount: invoice.amount,
    dueDate: invoice.due_date,
    status: invoice.status,
    paidAt: invoice.paid_at,
    createdAt: invoice.created_at,
    business,
  });

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.id.slice(0, 8)}.pdf"`,
    },
  });
}
