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

  // Look for other customer records that share this one's email or phone -
  // likely duplicates worth merging, excluding any pair already dismissed
  let duplicates = [];
  if (customer.email || customer.phone) {
    const orParts = [];
    if (customer.email) orParts.push(`email.ilike.${customer.email}`);
    if (customer.phone) orParts.push(`phone.eq.${customer.phone}`);
    const { data: possibleDupes } = await db
      .from("customers")
      .select("*")
      .or(orParts.join(","))
      .neq("id", customer.id);

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

      {duplicates.length > 0 && (
        <section style={duplicateCardStyle}>
          <div style={{ fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>
            ⚠️ Possible duplicate{duplicates.length > 1 ? "s" : ""}
          </div>
          {duplicates.map((dupe) => (
            <div key={dupe.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{dupe.name}</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
                {[dupe.phone, dupe.email].filter(Boolean).join(" · ")}
              </div>
              <form action="/api/clients/merge" method="POST" style={{ display: "flex", gap: 8 }}>
                <input type="hidden" name="keepId" value={customer.id} />
                <input type="hidden" name="mergeId" value={dupe.id} />
                <button type="submit" style={mergeButtonStyle}>
                  Merge into {customer.name}
                </button>
              </form>
              <form action="/api/clients/ignore-duplicate" method="POST" style={{ marginTop: 6 }}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="dupeId" value={dupe.id} />
                <button type="submit" style={ignoreButtonStyle}>
                  Not a duplicate - ignore
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

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
