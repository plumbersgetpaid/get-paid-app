import Link from "next/link";
import { getBusinessSettings } from "../../lib/getBusinessSettings";
import VoiceQuickBookAssist from "./VoiceQuickBookAssist";

export const dynamic = "force-dynamic";

export default async function QuickBook({ searchParams }) {
  const settings = await getBusinessSettings();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const initialCustomerName = searchParams?.customerName || "";
  const initialPhone = searchParams?.phone || "";
  const initialEmail = searchParams?.email || "";
  const initialJobType = searchParams?.jobType || "";
  const initialAmount = searchParams?.amount || "";
  const initialDate = searchParams?.startDate || defaultDate;
  const initialTime = searchParams?.startTime || "09:00";
  const initialDuration = searchParams?.durationValue || "2";
  const initialDurationUnit = searchParams?.durationUnit || "hours";
  const initialLocation = searchParams?.location || "";
  const initialIncludeWeekends =
    searchParams?.includeWeekends !== undefined
      ? searchParams.includeWeekends === "1"
      : settings.include_weekends;
  const conflictMessage = searchParams?.conflict;

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/calendar" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Quick book</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        For booking something in on the spot - no quote needed. You can
        invoice it properly later from "Jobs in progress."
      </p>

      {conflictMessage && (
        <div style={warningBoxStyle}>
          ⚠️ {conflictMessage} You can still book it in anyway if that's fine.
        </div>
      )}

      <form
        action="/api/calendar/quick-book"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        {conflictMessage && <input type="hidden" name="force" value="1" />}

        <VoiceQuickBookAssist
          initialCustomerName={initialCustomerName}
          initialPhone={initialPhone}
          initialEmail={initialEmail}
          initialJobType={initialJobType}
          initialAmount={initialAmount}
          initialDate={initialDate}
          initialTime={initialTime}
          initialDuration={initialDuration}
          initialDurationUnit={initialDurationUnit}
        />

        <input
          name="location"
          placeholder="Job location / address (optional)"
          defaultValue={initialLocation}
          style={inputStyle}
        />

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
            defaultChecked={initialIncludeWeekends}
          />
          Include weekends for this booking
          <span style={{ color: "#888", fontSize: 12 }}>
            (off = working days only)
          </span>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: "#666", fontWeight: 600 }}>
            Let the client know (if you add their email/phone above)
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="notifyEmail" value="1" defaultChecked />
            Email
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="notifyWhatsapp" value="1" defaultChecked />
            WhatsApp
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/calendar" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            {conflictMessage ? "Book anyway" : "Book it in"}
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

const warningBoxStyle = {
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 8,
  fontSize: 13,
  marginTop: 12,
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
