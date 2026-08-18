import { getBusinessSettings } from "../../lib/getBusinessSettings";
import { formatCurrency, formatInvoiceNumber } from "../../lib/formatCurrency";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../lib/auth";
import { canInvoice } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import BackButton from "../../components/BackButton";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function InvoiceDetail(props) {
  const params = await props.params;
  const { invoiceId } = params;
  const settings = await getBusinessSettings();

  // Invoices are financial information - gated by the specific
  // can_invoice permission now, not blanket owner/manager status, so a
  // specific subcontractor can be individually granted this. Staying
  // ahead of the scoped client below matters: it guarantees
  // currentMember is a real, valid record before that client is ever
  // constructed.
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);

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

  // Only used to decide whether to offer the photos link below - a link
  // to an empty gallery is worse than no link at all.
  const { count: photoCount } = job?.id
    ? await db
        .from("job_photos")
        .select("*", { count: "exact", head: true })
        .eq("job_id", job.id)
    : { count: 0 };

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
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Invoice</h1>
      </div>

      <section
        style={{
          background: "white",
          borderRadius: 3,
          padding: 24,
          border: "1px solid #e2e2e2",
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 4 }}>Invoice</h2>
        <div style={{ color: "#888", marginBottom: 20, fontSize: 13 }}>
          {formatInvoiceNumber(invoice.invoice_number)} ·{" "}
          {new Date(invoice.created_at).toLocaleDateString("en-GB")}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 500 }}>{customer?.name || "Customer"}</div>
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
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
            Payment link
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

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          download
          style={downloadButtonStyle}
        >
          Download PDF
        </a>
        {photoCount > 0 && (
          <Link href={`/jobs/photos/${job.id}`} style={quietActionStyle}>
            {photoCount} photo{photoCount === 1 ? "" : "s"}
          </Link>
        )}
        <a
          href={`/api/invoices/export-csv?invoiceId=${invoice.id}`}
          download
          style={downloadButtonStyle}
        >
          Download CSV
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
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 13,
};

const paymentLinkSaveButtonStyle = {
  background: "#000",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13,
};

const quietActionStyle = {
  display: "block",
  flex: 1,
  boxSizing: "border-box",
  textAlign: "center",
  background: "white",
  color: "#000",
  border: "1px solid #e2e2e2",
  padding: "14px",
  borderRadius: 2,
  fontWeight: 500,
  textDecoration: "none",
  fontSize: 13.5,
};

const downloadButtonStyle = {
  display: "block",
  flex: 1,
  boxSizing: "border-box",
  textAlign: "center",
  background: "#000",
  color: "white",
  border: "none",
  padding: "14px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 15,
  textDecoration: "none",
};
