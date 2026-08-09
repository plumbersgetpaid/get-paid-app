import Link from "next/link";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import VoiceReminderAssist from "./VoiceReminderAssist";

export const dynamic = "force-dynamic";

export default async function NewReminder() {
  const settings = await getBusinessSettings();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/calendar" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Personal reminder</h1>
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
        <VoiceReminderAssist initialDate={today} />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            background: "white",
            padding: 12,
            borderRadius: 8,
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
