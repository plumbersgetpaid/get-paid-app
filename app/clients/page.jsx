import Link from "next/link";
import { supabaseAdmin } from "../lib/supabaseClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Clients() {
  const db = supabaseAdmin();

  const { data: customers } = await db
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  // Work out how much each customer currently owes, without relying on the
  // outstanding_invoices view (it doesn't expose customer_id)
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

  const owedByCustomer = {};
  for (const inv of invoices || []) {
    const customerId = customerIdByJobId[inv.job_id];
    if (!customerId) continue;
    owedByCustomer[customerId] = (owedByCustomer[customerId] || 0) + Number(inv.amount);
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Clients</h1>
      </div>

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

      {(!customers || customers.length === 0) && (
        <p style={{ color: "#888" }}>
          No clients yet - they'll appear here automatically as you send
          quotes, or add one manually above.
        </p>
      )}

      {(customers || []).map((c) => (
        <Link
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
          {owedByCustomer[c.id] > 0 && (
            <div style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>
              £{owedByCustomer[c.id].toFixed(2)} outstanding
            </div>
          )}
        </Link>
      ))}
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
