import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeClientDatabase } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import BackButton from "../../../components/BackButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function EditClient({ params }) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeClientDatabase(currentMember)) {
    notFound();
  }

  const { customerId } = params;
  const db = await getScopedDb(currentMember);

  const { data: customer, error } = await db
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (error || !customer) {
    notFound();
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref={`/clients/${customerId}`} />
        <h1 style={{ fontSize: 20, margin: 0 }}>Edit client</h1>
      </div>

      <form
        action="/api/clients/update"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <input type="hidden" name="customerId" value={customer.id} />
        <input name="name" defaultValue={customer.name} required style={inputStyle} />
        <input name="phone" defaultValue={customer.phone || ""} placeholder="Phone" style={inputStyle} />
        <input
          name="email"
          type="email"
          defaultValue={customer.email || ""}
          placeholder="Email"
          style={inputStyle}
        />
        <input
          name="address"
          defaultValue={customer.address || ""}
          placeholder="Address"
          style={inputStyle}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href={`/clients/${customerId}`} style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Save changes
          </button>
        </div>
      </form>
    </main>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
};

const cancelButtonStyle = {
  background: "white",
  color: "#000",
  padding: "14px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontWeight: 500,
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
};

const submitButtonStyle = {
  background: "#000",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  flex: 1,
};
