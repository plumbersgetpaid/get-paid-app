import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeClientDatabase } from "../../../lib/permissions";
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
  const db = supabaseAdmin();

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
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
};

const cancelButtonStyle = {
  background: "white",
  color: "#111",
  padding: "14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontWeight: 600,
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
};

const submitButtonStyle = {
  background: "#111",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  flex: 1,
};
