import Link from "next/link";
import BackButton from "../../components/BackButton";
import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeClientDatabase } from "../../lib/permissions";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function NewClient() {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeClientDatabase(currentMember)) {
    notFound();
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/clients" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Add client</h1>
      </div>

      <form
        action="/api/clients/create"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <input name="name" placeholder="Name" required style={inputStyle} />
        <input name="phone" placeholder="Phone" style={inputStyle} />
        <input name="email" type="email" placeholder="Email" style={inputStyle} />
        <input name="address" placeholder="Address" style={inputStyle} />

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/clients" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Save client
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
