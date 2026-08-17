import Link from "next/link";
import BackButton from "../../components/BackButton";
import DuplicatesSection from "./DuplicatesSection";
import DeleteClientButton from "../../components/DeleteClientButton";
import { notFound } from "next/navigation";
import { getBusinessSettings } from "../../lib/getBusinessSettings";
import { formatCurrency } from "../../lib/formatCurrency";
import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything, canSeeClientDatabase } from "../../lib/permissions";
import { filterJobsForMember } from "../../lib/jobAccess";
import { getScopedDb } from "../../lib/scopedSupabaseClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ClientDetail({ params }) {
  const { customerId } = params;
  const settings = await getBusinessSettings();
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);

  // Same hard block as the clients list itself - if the database is
  // turned off for this person, that covers every client detail page
  // too, not just the list. They can still see this same customer's
  // name/phone/email inline on a job they're assigned to, which is a
  // separate, always-available path that isn't affected by this at all.
  //
  // Staying ahead of the scoped client below matters: it guarantees
  // currentMember is a real, valid record before that client is ever
  // constructed, since getScopedDb() requires one.
  if (!canSeeClientDatabase(currentMember)) {
    notFound();
  }

  // Now backed by Row Level Security at the database level - everything
  // below is otherwise unchanged. RLS only adds business-level
  // isolation; the subcontractor-level filtering further down (which
  // jobs someone's actually assigned to) still needs to run exactly as
  // it did before.
  const db = await getScopedDb(currentMember);

  const { data: customer, error } = await db
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (error || !customer) {
    notFound();
  }

  let jobsQuery = db
    .from("jobs")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  // A subcontractor sees jobs for this client they're directly assigned
  // to, plus anything shared with them - same filter used everywhere
  // else, so a shared (not directly assigned) job doesn't just vanish
  // from this client's history
  if (!showEverything) {
    jobsQuery = await filterJobsForMember(db, jobsQuery, currentMember?.id);
  }
  const { data: jobs } = await jobsQuery;

  // If a subcontractor has no assigned job for this client at all, this
  // client doesn't exist for them - matches the same rule the Clients
  // list itself already applies, checked again here since this page can
  // be reached directly by URL, not just by clicking through the list
  if (!showEverything && (!jobs || jobs.length === 0)) {
    notFound();
  }

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
  // Skipped entirely for a subcontractor - merging duplicate records is a
  // data-management concern for whoever runs the business, not them.
  let duplicates = [];
  if (showEverything && (customer.email || customer.phone)) {
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

      {showEverything && (
        <DuplicatesSection
          customerId={customer.id}
          customerName={customer.name}
          initialDuplicates={duplicates}
        />
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Job history</h2>
      {(!jobs || jobs.length === 0) && (
        <p style={{ color: "#888" }}>No jobs for this client yet.</p>
      )}
      {(jobs || []).map((job) => {
        const invoice = invoiceByJobId[job.id];
        return (
          <div key={job.id} style={jobCardStyle}>
            <div style={{ fontWeight: 500 }}>{job.job_type || "Job"}</div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {showEverything && <>{formatCurrency(job.amount, settings.currency)} · </>}
              <span style={{ textTransform: "capitalize" }}>
                {job.status.replace("_", " ")}
              </span>
              {showEverything && invoice && (
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
                {job.completion_note}
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              {showEverything && invoice && (
                <Link
                  href={`/invoices/${invoice.id}`}
                  style={{ fontSize: 12, color: "#000", textDecoration: "underline" }}
                >
                  View invoice →
                </Link>
              )}
              <a
                href={`/jobs/view/${job.id}`}
                style={{ fontSize: 12, color: "#000", textDecoration: "underline" }}
              >
                View job{noteCountByJob[job.id] ? ` (${noteCountByJob[job.id]} note${noteCountByJob[job.id] === 1 ? "" : "s"})` : ""}
              </a>
            </div>
          </div>
        );
      })}

      {showEverything && (!jobs || jobs.length === 0) && (
        <DeleteClientButton customerId={customer.id} />
      )}
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: 16,
  margin: "16px 0",
  border: "1px solid #e2e2e2",
};

const editLinkStyle = {
  fontSize: 13,
  color: "#000",
  textDecoration: "underline",
};

const jobCardStyle = {
  background: "white",
  borderRadius: 2,
  padding: 14,
  marginBottom: 8,
};
