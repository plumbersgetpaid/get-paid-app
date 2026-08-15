import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { notFound } from "next/navigation";
import BackButton from "../../../components/BackButton";
import PermissionsForm from "./PermissionsForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function TeamMemberPermissions({ params }) {
  const { memberId } = params;
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);
  const { data: member } = await db
    .from("team_members")
    .select(
      "id, name, role, can_invoice, can_see_client_database, can_create_quote, can_create_job, can_create_recurring_job, can_reschedule"
    )
    .eq("id", memberId)
    .maybeSingle();

  if (!member) {
    notFound();
  }

  if (member.role !== "subcontractor") {
    notFound();
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings/team" />
        <h1 style={{ fontSize: 20, margin: 0 }}>{member.name}'s permissions</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        Turn on anything {member.name} should be able to do beyond
        viewing and adding notes on their own assigned jobs. Everything
        below starts off by default.
      </p>

      <PermissionsForm member={member} />
    </main>
  );
}
