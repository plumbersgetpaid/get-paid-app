import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { formatInvoiceNumber } from "../../../lib/formatCurrency";
import { vatBreakdown } from "../../../lib/vat";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

function csvCell(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const invoiceId = searchParams.get("invoiceId");

  const db = await getScopedDb(currentMember);
  const settings = await getBusinessSettings();

  let query = db.from("invoices").select("*").order("created_at", { ascending: true });
  if (invoiceId) {
    query = query.eq("id", invoiceId);
  } else {
    if (start) query = query.gte("created_at", start);
    if (end) {
      const endDate = new Date(end);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("created_at", endDate.toISOString().slice(0, 10));
    }
  }

  const { data: invoices } = await query;
  const rows = invoices || [];

  const jobIds = [...new Set(rows.map((i) => i.job_id))];
  const { data: jobs } = jobIds.length
    ? await db.from("jobs").select("id, job_type, location, customer_id").in("id", jobIds)
    : { data: [] };
  const jobById = Object.fromEntries((jobs || []).map((j) => [j.id, j]));

  const customerIds = [...new Set((jobs || []).map((j) => j.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, name, email, phone, address").in("id", customerIds)
    : { data: [] };
  const customerById = Object.fromEntries((customers || []).map((c) => [c.id, c]));

  const header = [
    "Invoice Number",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Job Description",
    "Job Location",
    "Net Amount",
    "VAT Rate %",
    "VAT Amount",
    "Total Amount",
    "VAT Number",
    "Currency",
    "Date Issued",
    "Due Date",
    "Status",
    "Date Paid",
  ];

  const lines = [header.map(csvCell).join(",")];

  for (const inv of rows) {
    const job = jobById[inv.job_id];
    const customer = job ? customerById[job.customer_id] : null;
    // Per-invoice snapshot: a non-VAT invoice exports its full amount as net
    // with blank VAT columns, so accountant tools sum both kinds correctly.
    const vat = vatBreakdown(inv.amount, inv.vat_rate);

    lines.push(
      [
        formatInvoiceNumber(inv.invoice_number),
        customer?.name || "",
        customer?.email || "",
        customer?.phone || "",
        job?.job_type || "",
        job?.location || "",
        vat ? vat.net.toFixed(2) : Number(inv.amount).toFixed(2),
        vat ? vat.rate : "",
        vat ? vat.vat.toFixed(2) : "",
        Number(inv.amount).toFixed(2),
        inv.vat_number || "",
        settings.currency || "GBP",
        inv.created_at ? inv.created_at.slice(0, 10) : "",
        inv.due_date || "",
        inv.status || "",
        inv.paid_at ? inv.paid_at.slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = lines.join("\r\n");
  const filename = invoiceId
    ? `${formatInvoiceNumber(rows[0]?.invoice_number ?? "")}.csv`
    : `invoices${start ? `-${start}` : ""}${end ? `-to-${end}` : ""}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
