import { formatCurrency, formatInvoiceNumber } from "../lib/formatCurrency";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { getCurrentTeamMember } from "../lib/auth";
import { canInvoice } from "../lib/permissions";
import { getScopedDb } from "../lib/scopedSupabaseClient";
import { notFound } from "next/navigation";
import BackButton from "../components/BackButton";
import DateFieldWithHint from "../components/DateFieldWithHint";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function AllInvoices(props) {
  const searchParams = await props.searchParams;
  const settings = await getBusinessSettings();

  // Same rule as the invoice detail page - this entire section doesn't
  // exist for a subcontractor, checked on the server. Staying ahead of
  // the scoped client below matters: it guarantees currentMember is a
  // real, valid record before that client is ever constructed.
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);

  const rangeStart = searchParams?.start || "";
  const rangeEnd = searchParams?.end || "";
  const q = (searchParams?.q || "").trim().toLowerCase();

  let query = db.from("invoices").select("*").order("created_at", { ascending: false });

  if (rangeStart) {
    query = query.gte("created_at", rangeStart);
  }
  if (rangeEnd) {
    const endDate = new Date(rangeEnd);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt("created_at", endDate.toISOString().slice(0, 10));
  }

  const { data: rawInvoices, error } = await query;

  let invoices = rawInvoices || [];

  if (invoices.length > 0) {
    const jobIds = [...new Set(invoices.map((i) => i.job_id))];
    const { data: jobs } = await db
      .from("jobs")
      .select("id, job_type, customer_id")
      .in("id", jobIds);

    const jobById = Object.fromEntries((jobs || []).map((j) => [j.id, j]));

    const customerIds = [...new Set((jobs || []).map((j) => j.customer_id))];
    const { data: customers } = await db
      .from("customers")
      .select("id, name")
      .in("id", customerIds);

    const nameById = Object.fromEntries(
      (customers || []).map((c) => [c.id, c.name])
    );

    invoices = invoices.map((inv) => {
      const job = jobById[inv.job_id];
      return {
        ...inv,
        job_type: job?.job_type,
        customer_name: job ? nameById[job.customer_id] : "Unknown customer",
      };
    });
  }

  if (q) {
    invoices = invoices.filter((inv) => {
      const numberLabel = formatInvoiceNumber(inv.invoice_number).toLowerCase();
      return (
        (inv.customer_name || "").toLowerCase().includes(q) ||
        numberLabel.includes(q) ||
        String(inv.invoice_number).includes(q)
      );
    });
  }

  // Total invoiced = face value of every invoice (correct as-is: the invoice's
  // value is the full amount; a deposit is a payment against it).
  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  // Outstanding = what's actually still owed: on each UNPAID invoice, the
  // balance after any received deposit (not the full face value - the deposit
  // is money already in). Matches the deposit-aware Work tab.
  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce(
      (sum, i) =>
        sum + Math.max(0, Number(i.amount) - (Number(i.deposit_amount) || 0)),
      0
    );

  // Build a list of months that actually have invoices, for the bulk
  // download filter - based on the FULL history, not the current filter,
  // so the dropdown doesn't shrink when a custom range is applied
  const { data: allDates } = await db.from("invoices").select("created_at");
  const monthsSet = new Set(
    (allDates || []).map((inv) => inv.created_at.slice(0, 7))
  );
  const availableMonths = [...monthsSet]
    .sort()
    .reverse()
    .map((m) => {
      const [y, mo] = m.split("-").map(Number);
      const label = new Date(y, mo - 1, 1).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });
      return { value: m, label };
    });

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=invoices" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>All invoices</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        A full record of every invoice you've raised - handy to send your
        accountant, or tap any invoice to download it as a PDF.
      </p>

      <form action="/invoices" method="GET" style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {rangeStart && <input type="hidden" name="start" value={rangeStart} />}
        {rangeEnd && <input type="hidden" name="end" value={rangeEnd} />}
        <input
          type="search"
          name="q"
          placeholder="Search by customer or invoice #"
          defaultValue={searchParams?.q || ""}
          style={dateInputStyle}
        />
        <button type="submit" style={applyRangeButtonStyle}>
          Search
        </button>
      </form>

      <section
        style={{
          background: "white",
          borderRadius: 3,
          padding: 16,
          margin: "16px 0",
        }}
      >
        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>
          Custom date range
        </div>
        <form
          action="/invoices"
          method="GET"
          style={{ display: "grid", gap: 10 }}
        >
          {searchParams?.q && <input type="hidden" name="q" value={searchParams.q} />}
          <div style={{ display: "flex", gap: 10 }}>
            <DateFieldWithHint name="start" defaultValue={rangeStart} label="From" />
            <DateFieldWithHint name="end" defaultValue={rangeEnd} label="To" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={applyRangeButtonStyle}>
              View this period
            </button>
            {(rangeStart || rangeEnd) && (
              <Link href="/invoices" style={clearRangeButtonStyle}>
                Clear
              </Link>
            )}
          </div>
        </form>

        {(rangeStart || rangeEnd) && (
          <form
            action="/api/invoices/export"
            method="GET"
            style={{ display: "flex", gap: 8, marginTop: 10 }}
          >
            <input type="hidden" name="start" value={rangeStart} />
            <input type="hidden" name="end" value={rangeEnd} />
            <select name="format" style={formatSelectStyle}>
              <option value="pdf">PDF</option>
              <option value="csv">CSV (accountant/QuickBooks)</option>
            </select>
            <button type="submit" style={applyRangeButtonStyle}>
              Download
            </button>
          </form>
        )}
      </section>

      {(rangeStart || rangeEnd) && (
        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
          Showing {rangeStart || "the beginning"} to {rangeEnd || "now"}
        </div>
      )}

      <section
        style={{
          background: "white",
          borderRadius: 3,
          padding: 16,
          margin: "16px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          textAlign: "center",
          border: "1px solid #e2e2e2",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#888" }}>Total invoiced</div>
          <div style={{ fontSize: 17, fontWeight: 500, overflowWrap: "break-word" }}>
            {formatCurrency(totalInvoiced, settings.currency)}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#888" }}>Total paid</div>
          <div style={{ fontSize: 17, fontWeight: 500, overflowWrap: "break-word" }}>
            {formatCurrency(totalPaid, settings.currency)}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#888" }}>Outstanding</div>
          <div style={{ fontSize: 17, fontWeight: 500, overflowWrap: "break-word" }}>
            {formatCurrency(totalOutstanding, settings.currency)}
          </div>
        </div>
      </section>

      {error && (
        <div style={{ color: "#991b1b", fontSize: 13, marginBottom: 12 }}>
          Something went wrong loading invoices: {error.message}
        </div>
      )}

      {invoices.length > 0 && (
        <form
          action="/api/invoices/export"
          method="GET"
          style={{ display: "flex", gap: 8, marginBottom: 20 }}
        >
          <select name="month" style={monthSelectStyle}>
            <option value="">All invoices</option>
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select name="format" style={formatSelectStyle}>
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
          </select>
          <button type="submit" style={bulkDownloadButtonStyle}>
            Download
          </button>
        </form>
      )}

      {invoices.length === 0 && (
        <p style={{ color: "#888" }}>No invoices yet.</p>
      )}

      {invoices.map((inv) => (
        <Link
          key={inv.id}
          href={`/invoices/${inv.id}`}
          style={{
            display: "block",
            background: "white",
            borderRadius: 2,
            padding: 14,
            marginBottom: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 500 }}>{inv.customer_name}</div>
            <div style={{ fontWeight: 500 }}>{formatCurrency(inv.amount, settings.currency)}</div>
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {formatInvoiceNumber(inv.invoice_number)} · {inv.job_type || "Job"} · due {inv.due_date} ·{" "}
            <span style={{ textTransform: "capitalize" }}>{inv.status}</span>
          </div>
        </Link>
      ))}
    </main>
  );
}

const monthSelectStyle = {
  flex: 1,
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 14,
  background: "white",
};

const formatSelectStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 14,
  background: "white",
};

const bulkDownloadButtonStyle = {
  background: "#000",
  color: "white",
  border: "none",
  padding: "12px 16px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 14,
};

const dateInputStyle = {
  display: "block",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 14,
  marginTop: 4,
};

const applyRangeButtonStyle = {
  background: "#000",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13,
  flex: 1,
};

const clearRangeButtonStyle = {
  background: "white",
  color: "#000",
  border: "1px solid #e2e2e2",
  padding: "10px 16px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13,
  textDecoration: "none",
  textAlign: "center",
};
