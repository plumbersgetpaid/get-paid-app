import Link from "next/link";
import BackButton from "../../components/BackButton";
import DuplicatesSection from "./DuplicatesSection";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../lib/supabaseClient";
import { getBusinessSettings } from "../../lib/getBusinessSettings";
import { formatCurrency } from "../../lib/formatCurrency";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }) {
  const { customerId } = params;
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();

  const { data: customer, error } = await db
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (error || !customer) {
    notFound();
  }

  const { data: jobs } = await db
    .from("jobs")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const jobIds = (jobs || []).map((j) => j.id);
  const { data: invoices } = jobIds.length
    ? await db.from("invoices").select("*").in("job_id", jobIds)
    : { data: [] };
  const invoiceByJobId = Object.fromEntries(
    (invoices || []).map((inv) => [inv.job_id, inv])
  );

  const { data: noteRows } = jobIds.length
    ? await db.from("job_notes").select("job_id").in("job_id", jobIds)
    : { data: [] };
  const noteCountByJob = {};
  for (const n of noteRows || []) {
    noteCountByJob[n.job_id] = (noteCountByJob[n.job_id] || 0) + 1;
  }

  // Look for other customer records that share this one's email or phone -
  // likely duplicates worth merging, excluding any pair already dismissed.
  // Uses separate lookups rather than a combined filter, since combined
  // filters can misbehave on values containing dots (common in emails).
  let duplicates = [];
  if (customer.email || customer.phone) {
    const dupeMap = {};

    if (customer.email) {
      const { data } = await db
        .from("customers")
        .select("*")
        .ilike("email", customer.email)
        .neq("id", customer.id);
      for (const d of data || []) dupeMap[d.id] = d;
    }
    if (customer.phone) {
      const { data } = await db
        .from("customers")
        .select("*")
        .eq("phone", customer.phone)
        .neq("id", customer.id);
      for (const d of data || []) dupeMap[d.id] = d;
    }
    const possibleDupes = Object.values(dupeMap);

    const { data: ignoredRows } = await db
      .from("ignored_duplicates")
      .select("customer_id_a, customer_id_b")
      .or(`customer_id_a.eq.${customer.id},customer_id_b.eq.${customer.id}`);

    const ignoredIds = new Set(
      (ignoredRows || []).map((r) =>
        r.customer_id_a === customer.id ? r.customer_id_b : r.customer_id_a
      )
    );

    duplicates = (possibleDupes || []).filter((d) => !ignoredIds.has(d.id));
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/clients" forceFresh />
        <h1 style={{ fontSize: 20, margin: 0 }}>{customer.name}</h1>
      </div>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {customer.phone && <div style={{ fontSize: 14 }}>{customer.phone}</div>}
            {customer.email && <div style={{ fontSize: 14 }}>{customer.email}</div>}
            {customer.address && (
              <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
                {customer.address}
              </div>
            )}
            {!customer.phone && !customer.email && !customer.address && (
              <div style={{ fontSize: 13, color: "#888" }}>No contact details on file</div>
            )}
          </div>
          <Link href={`/clients/${customer.id}/edit`} style={editLinkStyle}>
            Edit
          </Link>
        </div>
      </section>

      <DuplicatesSection
        customerId={customer.id}
        customerName={customer.name}
        initialDuplicates={duplicates}
      />

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Job history</h2>
      {(!jobs || jobs.length === 0) && (
        <p style={{ color: "#888" }}>No jobs for this client yet.</p>
      )}
      {(jobs || []).map((job) => {
        const invoice = invoiceByJobId[job.id];
        return (
          <div key={job.id} style={jobCardStyle}>
            <div style={{ fontWeight: 600 }}>{job.job_type || "Job"}</div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {formatCurrency(job.amount, settings.currency)} ·{" "}
              <span style={{ textTransform: "capitalize" }}>
                {job.status.replace("_", " ")}
              </span>
              {invoice && (
                <>
                  {" · invoice "}
                  <span style={{ textTransform: "capitalize" }}>{invoice.status}</span>
                </>
              )}
            </div>
            {job.location && (
              <div style={{ fontSize: 12, color: "#888" }}>📍 {job.location}</div>
            )}
            {job.completion_note && (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4, fontStyle: "italic" }}>
                📝 {job.completion_note}
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              {invoice && (
                <Link
                  href={`/invoices/${invoice.id}`}
                  style={{ fontSize: 12, color: "#111", textDecoration: "underline" }}
                >
                  View invoice →
                </Link>
              )}
              <Link
                href={`/jobs/notes/${job.id}`}
                style={{ fontSize: 12, color: "#111", textDecoration: "underline" }}
              >
                📝 Notes{noteCountByJob[job.id] ? ` (${noteCountByJob[job.id]})` : ""}
              </Link>
            </div>
          </div>
        );
      })}
    </main>
  );
}

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

const cardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const editLinkStyle = {
  fontSize: 13,
  color: "#111",
  textDecoration: "underline",
};

const jobCardStyle = {
  background: "white",
  borderRadius: 10,
  padding: 14,
  marginBottom: 8,
};

const duplicateCardStyle = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const mergeButtonStyle = {
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const ignoreButtonStyle = {
  background: "none",
  border: "none",
  color: "#666",
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
};
