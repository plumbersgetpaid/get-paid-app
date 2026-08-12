import { supabaseAdmin } from "../../lib/supabaseClient";
import { getBusinessSettings } from "../../lib/getBusinessSettings";
import { formatCurrency, formatInvoiceNumber } from "../../lib/formatCurrency";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything } from "../../lib/permissions";
import BackButton from "../../components/BackButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }) {
  const { invoiceId } = params;
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();

  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  const { data: invoice, error } = await db
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    notFound();
  }

  const { data: job } = await db
    .from("jobs")
    .select("*")
    .eq("id", invoice.job_id)
    .single();

  const { data: customer } = job?.customer_id
    ? await db.from("customers").select("*").eq("id", job.customer_id).single()
    : { data: null };

  return (
    <main>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <BackButton fallbackHref="/invoices" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Invoice</h1>
      </div>

      <section
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>Invoice</h2>
        <div style={{ color: "#888", marginBottom: 20, fontSize: 13 }}>
          {formatInvoiceNumber(invoice.invoice_number)} ·{" "}
          {new Date(invoice.created_at).toLocaleDateString("en-GB")}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600 }}>{customer?.name || "Customer"}</div>
          {customer?.email && (
            <div style={{ color: "#888", fontSize: 14 }}>{customer.email}</div>
          )}
          {customer?.phone && (
            <div style={{ color: "#888", fontSize: 14 }}>{customer.phone}</div>
          )}
          {job?.location && (
            <div style={{ color: "#888", fontSize: 14 }}>{job.location}</div>
          )}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>
              <th style={{ padding: "8px 0", fontSize: 13, color: "#888" }}>
                Description
              </th>
              <th
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontSize: 13,
                  color: "#888",
                }}
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "10px 0" }}>
                {job?.job_type || "Plumbing work"}
              </td>
              <td style={{ padding: "10px 0", textAlign: "right" }}>
                {formatCurrency(invoice.amount, settings.currency)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              color: "#666",
              marginBottom: 6,
            }}
          >
            <span>Due date</span>
            <span>{invoice.due_date}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              color: "#666",
              marginBottom: 6,
            }}
          >
            <span>Status</span>
            <span style={{ textTransform: "capitalize" }}>{invoice.status}</span>
          </div>
          {invoice.paid_at && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                color: "#666",
              }}
            >
              <span>Paid on</span>
              <span>{new Date(invoice.paid_at).toLocaleDateString("en-GB")}</span>
            </div>
          )}
        </div>

        <section style={paymentLinkCardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            💳 Payment link
          </div>
          {invoice.payment_link && (
            <div style={{ marginBottom: 10 }}>
              <a
                href={invoice.payment_link}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: "#2563eb", wordBreak: "break-all" }}
              >
                {invoice.payment_link}
              </a>
            </div>
          )}
          <form action="/api/invoices/set-payment-link" method="POST" style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <input
              type="url"
              name="paymentLink"
              placeholder="https://... - Stripe or GoCardless link"
              defaultValue={invoice.payment_link || ""}
              style={paymentLinkInputStyle}
            />
            <button type="submit" style={paymentLinkSaveButtonStyle}>
              Save
            </button>
          </form>
          <span style={{ fontSize: 11, color: "#888", display: "block", marginTop: 6 }}>
            Adds a "Pay now" button to the invoice PDF and any future emails
            about it - bank details still show either way.
          </span>
        </section>
      </section>

      <div style={{ marginTop: 20 }}>
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          download
          style={downloadButtonStyle}
        >
          Download as PDF
        </a>
      </div>
    </main>
  );
}

const paymentLinkCardStyle = {
  borderTop: "1px solid #eee",
  marginTop: 20,
  paddingTop: 16,
};

const paymentLinkInputStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 13,
};

const paymentLinkSaveButtonStyle = {
  background: "#111",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const downloadButtonStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "center",
  background: "#111",
  color: "white",
  border: "none",
  padding: "14px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 15,
  textDecoration: "none",
};

const backButtonStyle = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#111",
};
