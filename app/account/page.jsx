import Link from "next/link";
import { getCurrentTeamMember } from "../lib/auth";
import { redirect } from "next/navigation";
import BackButton from "../components/BackButton";
import AccountForm from "./AccountForm";
import NotificationToggle from "../components/NotificationToggle";
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
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>My account</h1>
      </div>

      <section style={cardStyle}>
        <div style={{ fontSize: 13, color: "#888" }}>Role</div>
        <div style={{ fontSize: 15, textTransform: "capitalize" }}>{currentMember.role}</div>
      </section>

      <AccountForm currentName={currentMember.name} currentEmail={currentMember.email} />

      <NotificationToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} />

      <Link href="/help" style={{ ...cardStyle, display: "block", textDecoration: "none", color: "#000" }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>Help →</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
          Ask a question about how PatchUp works, any time
        </div>
      </Link>

      {/* This page is reachable by every role, unlike Settings which is
          owner/manager only - previously the only Log out button in the
          whole app lived on Settings, which meant a subcontractor had no
          way to log out at all */}
      <div style={{ marginTop: 24 }}>
        <LogoutButton />
      </div>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: "var(--card-pad, 16px)",
  margin: "16px 0",
  border: "1px solid #e2e2e2",
};
