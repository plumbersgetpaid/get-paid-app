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
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
};

const backButtonStyle = {
  background: "white",
  border: "1px solid #e2e2e2",
  borderRadius: 2,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#000",
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
