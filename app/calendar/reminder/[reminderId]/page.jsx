import { supabaseAdmin } from "../../../lib/supabaseClient";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import Link from "next/link";
import BackButton from "../../../components/BackButton";

export const dynamic = "force-dynamic";

export default async function ReminderDetail({ params }) {
  const { reminderId } = params;
  const db = supabaseAdmin();

  const currentMember = await getCurrentTeamMember();

  const { data: reminder, error } = await db
    .from("personal_events")
    .select("*")
    .eq("id", reminderId)
    .single();

  if (error || !reminder || reminder.created_by !== currentMember?.id) {
    notFound();
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
        <h1 style={{ fontSize: 20, margin: 0 }}>Personal reminder</h1>
      </div>

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
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  flex: 1,
  width: "100%",
  boxSizing: "border-box",
};

const backButtonStyle = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#111",
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
  background: "#16a34a",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  flex: 2,
};

const deleteButtonStyle = {
  width: "100%",
  background: "white",
  color: "#b91c1c",
  padding: "12px",
  borderRadius: 10,
  border: "1px solid #fca5a5",
  fontWeight: 600,
};
