import Link from "next/link";
import BackButton from "../../../components/BackButton";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import MultiAssignField from "../../../components/MultiAssignField";
import VoiceReminderAssist from "./VoiceReminderAssist";
import RequestIdField from "../../../components/RequestIdField";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function NewReminder() {
  const settings = await getBusinessSettings();
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);
  const today = new Date().toISOString().slice(0, 10);

  // Only owner/manager can share a reminder with someone else - a
  // subcontractor's reminder stays private to them, same as always
  let teamMembers = [];
  if (showEverything) {
    const db = await getScopedDb(currentMember);
    const { data } = await db
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .neq("id", currentMember.id)
      .order("name");
    teamMembers = data || [];
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/calendar" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Personal reminder</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        For anything you want on your calendar that isn't a job - no client
        needed.
      </p>

      <form
        action="/api/calendar/reminder/create"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <RequestIdField />
        <VoiceReminderAssist initialDate={today} />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            background: "white",
            padding: 12,
            borderRadius: 2,
          }}
        >
          <input
            type="checkbox"
            name="includeWeekends"
            value="1"
            defaultChecked={settings.include_weekends}
          />
          Include weekends for this reminder
        </label>

        {showEverything && teamMembers.length > 0 && (
          <label style={{ fontSize: 13, color: "#666" }}>
            Also share with (optional)
            <div style={{ marginTop: 6 }}>
              <MultiAssignField teamMembers={teamMembers} name="sharedWith" />
            </div>
          </label>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/calendar" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Save reminder
          </button>
        </div>
      </form>
    </main>
  );
}

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
  background: "#16a34a",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  flex: 2,
};
