import Link from "next/link";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything, canSeeClientDatabase } from "../lib/permissions";
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

  if (!canSeeClientDatabase(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);

  const q = (searchParams?.q || "").trim().toLowerCase();

  const { data: rawCustomers } = await db
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  let customers = rawCustomers || [];

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
  <div style={{ width: 6, height: 24, background: "#d97706", borderRadius: 3 }} />
  <h1 style={{ fontSize: 20, margin: 0 }}>Clients</h1>
</div>
      
      {showEverything && (
        <Link
          href="/clients/new"
          style={{
            display: "block",
            textAlign: "center",
            background: "#111",
            color: "white",
            padding: "12px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 600,
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
            background: "white",
            borderRadius: 10,
            padding: 14,
            marginBottom: 8,
            textDecoration: "none",
            color: "#111",
          }}
        >
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details on file"}
          </div>
          {isDuplicate(c) && (
            <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4, fontWeight: 600 }}>
              ⚠️ Possible duplicate - tap to review
            </div>
          )}
          {owedByCustomer[c.id] > 0 && showEverything && (
            <div style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>
              {formatCurrency(owedByCustomer[c.id], settings.currency)} outstanding
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
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
};

const searchButtonStyle = {
  background: "#111",
  color: "white",
  border: "none",
  padding: "12px 16px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
};
