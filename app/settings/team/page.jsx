import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import AddTeamMemberForm from "./AddTeamMemberForm";
import TeamMemberRow from "./TeamMemberRow";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Team() {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);
  const { data: members } = await db
    .from("team_members")
    .select("id, name, email, role, is_active, created_at")
    .order("created_at", { ascending: true });

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Team</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        Managers see everything you do. Team members only see jobs
        assigned to them, with no money or client list beyond that.
      </p>

      <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 20 }}>Current team</h2>
      {(members || []).map((m) => (
        <TeamMemberRow key={m.id} member={m} isSelf={m.id === currentMember.id} />
      ))}

      <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Add someone new</h2>
      <AddTeamMemberForm />
    </main>
  );
}
