import Link from "next/link";
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

  const { data: photoRows } = jobIds.length
    ? await db.from("job_photos").select("job_id").in("job_id", jobIds)
    : { data: [] };
  const photoCountByJob = {};
  for (const p of photoRows || []) {
    photoCountByJob[p.job_id] = (photoCountByJob[p.job_id] || 0) + 1;
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/clients" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
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
                href={`/jobs/photos/${job.id}`}
                style={{ fontSize: 12, color: "#111", textDecoration: "underline" }}
              >
                📷 Photos{photoCountByJob[job.id] ? ` (${photoCountByJob[job.id]})` : ""}
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
