import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // format YYYY-MM, optional

  const db = supabaseAdmin();

  let query = db.from("invoices").select("*").order("created_at", { ascending: true });

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const nextMonth = new Date(y, m, 1); // first day of the following month
    const end = nextMonth.toISOString().slice(0, 10);
    query = query.gte("created_at", start).lt("created_at", end);
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
      "Content-Disposition": `attachment; filename="invoices-${month || "all"}.pdf"`,
    },
  });
}
