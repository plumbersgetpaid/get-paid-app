import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // format YYYY-MM, optional
  const start = searchParams.get("start"); // format YYYY-MM-DD, optional
  const end = searchParams.get("end"); // format YYYY-MM-DD, optional

  const db = supabaseAdmin();

  let query = db.from("invoices").select("*").order("created_at", { ascending: true });
  let filenameSuffix = "all";

  if (start || end) {
    // Custom date range takes priority over the month picker
    if (start) {
      query = query.gte("created_at", start);
    }
    if (end) {
      // Include the whole end day by using the next day as an exclusive upper bound
      const endDate = new Date(end);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("created_at", endDate.toISOString().slice(0, 10));
    }
    filenameSuffix = `${start || "start"}_to_${end || "now"}`;
  } else if (month) {
    const [y, m] = month.split("-").map(Number);
    const monthStart = `${month}-01`;
    const nextMonth = new Date(y, m, 1); // first day of the following month
    const monthEnd = nextMonth.toISOString().slice(0, 10);
    query = query.gte("created_at", monthStart).lt("created_at", monthEnd);
    filenameSuffix = month;
  }

  const { data: invoices, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!invoices || invoices.length === 0) {
    return new Response(
      JSON.stringify({ error: "No invoices found for that period" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const jobIds = [...new Set(invoices.map((i) => i.job_id))];
  const { data: jobs } = await db
    .from("jobs")
    .select("id, job_type, customer_id")
    .in("id", jobIds);
  const jobById = Object.fromEntries((jobs || []).map((j) => [j.id, j]));

  const customerIds = [...new Set((jobs || []).map((j) => j.customer_id))];
  const { data: customers } = await db
    .from("customers")
    .select("id, name, email, phone")
    .in("id", customerIds);
  const customerById = Object.fromEntries((customers || []).map((c) => [c.id, c]));

  const mergedPdf = await PDFDocument.create();

  const settings = await getBusinessSettings();
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
  };

  for (const inv of invoices) {
    const job = jobById[inv.job_id];
    const customer = job ? customerById[job.customer_id] : null;

    const singleBytes = await generateInvoicePdfBytes({
      invoiceIdShort: inv.id.slice(0, 8).toUpperCase(),
      customerName: customer?.name,
      customerEmail: customer?.email,
      customerPhone: customer?.phone,
      jobType: job?.job_type,
      amount: inv.amount,
      dueDate: inv.due_date,
      status: inv.status,
      paidAt: inv.paid_at,
      createdAt: inv.created_at,
      business,
    });

    const singlePdf = await PDFDocument.load(singleBytes);
    const copiedPages = await mergedPdf.copyPages(singlePdf, singlePdf.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }

  const mergedBytes = await mergedPdf.save();

  return new Response(Buffer.from(mergedBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoices-${filenameSuffix}.pdf"`,
    },
  });
}
