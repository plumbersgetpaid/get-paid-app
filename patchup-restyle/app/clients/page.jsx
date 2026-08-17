import Link from "next/link";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything, canSeeClientDatabase } from "../lib/permissions";
// Colours imported as `ui` rather than `c`: this file already maps over
// customers using `c`, which would shadow the import inside the loop and
// silently render the cards unstyled.
import { poppins, mono, metallicTitleStyle, silverAccentStyle, c as ui } from "../lib/theme";
import { getSharedJobIds } from "../lib/jobAccess";
import { getScopedDb } from "../lib/scopedSupabaseClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Clients({ searchParams }) {
  const settings = await getBusinessSettings();
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);

  // A specific subcontractor can have the client database turned off
  // entirely (default: on, matching current behaviour) - this is a hard
  // block on the whole section, not filtering, since the point of
  // turning it off is that this person shouldn't be able to browse
  // clients as their own section at all, only see a client's details
  // inline within a job they're actually assigned to.
  //
  // This check staying ahead of the scoped client below matters: it
  // guarantees currentMember is a real, valid record before that client
  // is ever constructed, since getScopedDb() requires one.
  if (!canSeeClientDatabase(currentMember)) {
    notFound();
  }

  // Now backed by Row Level Security at the database level, not just
  // this file remembering to filter by business - everything below is
  // otherwise unchanged. RLS only adds business-level isolation; it
  // doesn't replace the subcontractor-level filtering further down,
  // which still needs to run exactly as it did before.
  const db = await getScopedDb(currentMember);

  const q = (searchParams?.q || "").trim().toLowerCase();

  const { data: rawCustomers } = await db
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  let customers = rawCustomers || [];

  // A subcontractor only ever sees clients tied to a job specifically
  // assigned to them or shared with them - not the full customer list,
  // and not clients from jobs assigned to someone else or booked before
  // they had an account
  if (!showEverything) {
    const { data: assignedJobs } = await db
      .from("jobs")
      .select("customer_id")
      .eq("assigned_to", currentMember?.id || "__none__");
    const sharedJobIds = await getSharedJobIds(db, currentMember?.id);
    const { data: sharedJobs } = sharedJobIds.length
      ? await db.from("jobs").select("customer_id").in("id", sharedJobIds)
      : { data: [] };
    const allowedCustomerIds = new Set(
      [...(assignedJobs || []), ...(sharedJobs || [])].map((j) => j.customer_id)
    );
    customers = customers.filter((c) => allowedCustomerIds.has(c.id));
  }

  // Duplicate detection and merging is a data-management concern for
  // whoever runs the business, not something a subcontractor needs -
  // skip the queries entirely for them rather than compute and hide it
  let isDuplicate = () => false;
  if (showEverything) {
    const byEmail = {};
    const byPhone = {};
    for (const c of rawCustomers || []) {
      if (c.email) {
        const key = c.email.trim().toLowerCase();
        (byEmail[key] ||= []).push(c.id);
      }
      if (c.phone) {
        const key = c.phone.trim();
        (byPhone[key] ||= []).push(c.id);
      }
    }

    const { data: ignoredRows } = await db
      .from("ignored_duplicates")
      .select("customer_id_a, customer_id_b");
    const ignoredPairs = new Set(
      (ignoredRows || []).flatMap((r) => [
        `${r.customer_id_a}|${r.customer_id_b}`,
        `${r.customer_id_b}|${r.customer_id_a}`,
      ])
    );

    isDuplicate = (c) => {
      const matchIds = new Set();
      if (c.email) {
        for (const id of byEmail[c.email.trim().toLowerCase()] || []) {
          if (id !== c.id) matchIds.add(id);
        }
      }
      if (c.phone) {
        for (const id of byPhone[c.phone.trim()] || []) {
          if (id !== c.id) matchIds.add(id);
        }
      }
      for (const otherId of matchIds) {
        if (!ignoredPairs.has(`${c.id}|${otherId}`)) return true;
      }
      return false;
    };
  }

  if (q) {
    customers = customers.filter((c) =>
      [c.name, c.phone, c.email].some((field) =>
        (field || "").toLowerCase().includes(q)
      )
    );
  }

  // Work out how much each customer currently owes, without relying on the
  // outstanding_invoices view (it doesn't expose customer_id) - skipped
  // entirely for a subcontractor, since this is financial information
  let owedByCustomer = {};
  if (showEverything) {
    const { data: jobs } = await db.from("jobs").select("id, customer_id");
    const customerIdByJobId = Object.fromEntries(
      (jobs || []).map((j) => [j.id, j.customer_id])
    );

    const jobIds = (jobs || []).map((j) => j.id);
    const { data: invoices } = jobIds.length
      ? await db
          .from("invoices")
          .select("job_id, amount, status")
          .neq("status", "paid")
          .in("job_id", jobIds)
      : { data: [] };

    for (const inv of invoices || []) {
      const customerId = customerIdByJobId[inv.job_id];
      if (!customerId) continue;
      owedByCustomer[customerId] = (owedByCustomer[customerId] || 0) + Number(inv.amount);
    }
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 6, height: 26, borderRadius: 2, flexShrink: 0, ...silverAccentStyle }} />
        <h1 className={poppins.className} style={{ ...metallicTitleStyle, fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          Clients
        </h1>
      </div>

      {showEverything && (
        <Link
          href="/clients/new"
          style={{
            display: "block",
            textAlign: "center",
            background: ui.ink,
            color: ui.paper,
            padding: "13px",
            borderRadius: 2,
            textDecoration: "none",
            fontWeight: 500,
            fontSize: 13.5,
            margin: "16px 0",
          }}
        >
          + Add client
        </Link>
      )}

      <form action="/clients" method="GET" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="search"
          name="q"
          placeholder="Search by name, phone, or email"
          defaultValue={searchParams?.q || ""}
          style={searchInputStyle}
        />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {(!customers || customers.length === 0) && (
        <p style={{ color: "#888" }}>
          No clients yet - they'll appear here automatically as you send
          quotes, or add one manually above.
        </p>
      )}

      {(customers || []).map((c) => (
        <a
          key={c.id}
          href={`/clients/${c.id}`}
          style={{
            display: "block",
            background: ui.paper,
            border: `1px solid ${ui.line}`,
            borderRadius: 3,
            padding: 14,
            marginBottom: 8,
            textDecoration: "none",
            color: ui.ink,
          }}
        >
          <div style={{ fontWeight: 500, fontSize: 15 }}>{c.name}</div>
          <div className={mono.className} style={contactStyle}>
            {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details on file"}
          </div>
          {isDuplicate(c) && (
            <div style={dupWarnStyle}>
              <span style={{ width: 3, height: 14, borderRadius: 2, background: "#b91c1c", flexShrink: 0 }} />
              Possible duplicate - tap to review
            </div>
          )}
          {owedByCustomer[c.id] > 0 && showEverything && (
            <div className={mono.className} style={owedStyle}>
              {formatCurrency(owedByCustomer[c.id], settings.currency)} OUTSTANDING
            </div>
          )}
        </a>
      ))}
    </main>
  );
}

const searchInputStyle = {
  flex: 1,
  padding: "12px",
  borderRadius: 2,
  border: `1px solid ${ui.line}`,
  fontSize: 15,
};

const searchButtonStyle = {
  background: ui.ink,
  color: ui.paper,
  border: "none",
  padding: "12px 16px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13.5,
};

const contactStyle = {
  fontSize: 11.5,
  color: ui.mid,
  marginTop: 5,
  letterSpacing: "0.02em",
};

const dupWarnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12.5,
  color: "#b91c1c",
  marginTop: 7,
  fontWeight: 500,
};

const owedStyle = {
  fontSize: 11.5,
  color: "#b45309",
  marginTop: 6,
  letterSpacing: "0.03em",
};
