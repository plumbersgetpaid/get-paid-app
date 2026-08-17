import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { canAccessReminder } from "../../../lib/reminderAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import MultiAssignField from "../../../components/MultiAssignField";
import Link from "next/link";
import BackButton from "../../../components/BackButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ReminderDetail({ params }) {
  const { reminderId } = params;

  // Fetched ahead of the job itself now - the scoped client needs to
  // know who's logged in (and their business) before it can even be
  // constructed, so this can no longer come after the reminder lookup
  // the way it originally did.
  const currentMember = await getCurrentTeamMember();
  const db = await getScopedDb(currentMember);

  const { data: reminder, error } = await db
    .from("personal_events")
    .select("*")
    .eq("id", reminderId)
    .single();

  if (error || !reminder) {
    notFound();
  }

  // A reminder is accessible to whoever made it, or anyone it's been
  // shared with - full access either way, same as jobs
  const hasAccess = await canAccessReminder(db, reminder, currentMember?.id);
  if (!hasAccess) {
    notFound();
  }

  const isCreator = reminder.created_by === currentMember?.id;
  const showEverything = canSeeEverything(currentMember);

  // Only owner/manager, and only if they made this one, can change who
  // it's shared with - matches how sharing is managed everywhere else
  let teamMembers = [];
  let currentSharedIds = [];
  if (showEverything && isCreator) {
    const { data } = await db
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .neq("id", currentMember.id)
      .order("name");
    teamMembers = data || [];

    const { data: shares } = await db
      .from("reminder_shares")
      .select("team_member_id")
      .eq("reminder_id", reminderId);
    currentSharedIds = (shares || []).map((s) => s.team_member_id);
  }

  const start = new Date(reminder.scheduled_start);
  const end = new Date(reminder.scheduled_end);
  const durationHours = (end - start) / (1000 * 60 * 60);
  const initialDate = start.toISOString().slice(0, 10);
  const initialTime = start.toISOString().slice(11, 16);

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/calendar" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Personal reminder</h1>
      </div>

      {!isCreator && (
        <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
          Shared with you - anyone on this reminder can edit or delete it.
        </p>
      )}

      <form
        action="/api/calendar/reminder/update"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <input type="hidden" name="reminderId" value={reminder.id} />

        <input name="title" defaultValue={reminder.title} required style={inputStyle} />
        <textarea
          name="notes"
          defaultValue={reminder.notes || ""}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <input type="date" name="startDate" defaultValue={initialDate} required style={inputStyle} />
          <input type="time" name="startTime" defaultValue={initialTime} required style={inputStyle} />
        </div>

        <label style={{ fontSize: 12, color: "#666" }}>
          Duration (hours)
          <input
            type="number"
            name="durationValue"
            min="0.25"
            step="0.25"
            defaultValue={durationHours}
            required
            style={inputStyle}
          />
        </label>

        {showEverything && isCreator && (
          <label style={{ fontSize: 13, color: "#666" }}>
            Also share with
            <div style={{ marginTop: 6 }}>
              <MultiAssignField
                teamMembers={teamMembers}
                name="sharedWith"
                initialSelectedIds={currentSharedIds}
              />
            </div>
          </label>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/calendar" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Save changes
          </button>
        </div>
      </form>

      <form action="/api/calendar/reminder/delete" method="POST" style={{ marginTop: 16 }}>
        <input type="hidden" name="reminderId" value={reminder.id} />
        <button type="submit" style={deleteButtonStyle}>
          Delete reminder
        </button>
      </form>
    </main>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  flex: 1,
  width: "100%",
  boxSizing: "border-box",
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
  background: "#16a34a",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  flex: 2,
};

const deleteButtonStyle = {
  width: "100%",
  background: "white",
  color: "#b91c1c",
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #fca5a5",
  fontWeight: 500,
};
