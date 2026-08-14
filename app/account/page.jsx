import { getCurrentTeamMember } from "../lib/auth";
import { redirect } from "next/navigation";
import BackButton from "../components/BackButton";
import AccountForm from "./AccountForm";
import LogoutButton from "../components/LogoutButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Account() {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    redirect("/login");
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/" />
        <h1 style={{ fontSize: 20, margin: 0 }}>My account</h1>
      </div>

      <section style={cardStyle}>
        <div style={{ fontSize: 13, color: "#888" }}>Role</div>
        <div style={{ fontSize: 15, textTransform: "capitalize" }}>{currentMember.role}</div>
      </section>

      <AccountForm currentName={currentMember.name} currentEmail={currentMember.email} />

      <div style={{ marginTop: 24 }}>
        <LogoutButton />
      </div>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};
