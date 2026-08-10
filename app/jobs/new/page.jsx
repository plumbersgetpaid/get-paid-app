import Link from "next/link";
import BackButton from "../../components/BackButton";
import { getBusinessSettings } from "../../lib/getBusinessSettings";
import VoiceQuoteAssist from "./VoiceQuoteAssist";

export default async function NewQuote() {
  const settings = await getBusinessSettings();
  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/" />
        <h1 style={{ fontSize: 20, margin: 0 }}>New quote</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        This sends the customer a quote. Once they accept, it'll move into
        "Jobs in progress" and you can invoice them when the work's done.
      </p>

      <form
        action="/api/jobs/create"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <input name="name" placeholder="Customer name" required style={inputStyle} />
        <input
          name="phone"
          placeholder="Phone (for SMS/WhatsApp chase)"
          style={inputStyle}
        />
        <input name="email" type="email" placeholder="Email" style={inputStyle} />

        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
          Speak the job details instead of typing - AI will fill these in for
          you, and you can edit before sending. Tap ✨ to tidy up what you've
          typed.
        </div>
        <VoiceQuoteAssist />

        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: 13, color: "#666", fontWeight: 600, cursor: "pointer" }}>
            Proposed date &amp; duration (optional)
          </summary>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "#888" }}>
              If the customer accepts, the job will already be booked in with
              these details - you can still adjust before confirming.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input type="date" name="proposedDate" style={inputStyle} />
              <input type="time" name="proposedTime" defaultValue="09:00" style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                name="durationValue"
                min="0.5"
                step="0.5"
                placeholder="Duration"
                style={{ ...inputStyle, flex: 2 }}
              />
              <select name="durationUnit" defaultValue="hours" style={{ ...inputStyle, flex: 1 }}>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#666",
              }}
            >
              <input
                type="checkbox"
                name="includeWeekends"
                value="1"
                defaultChecked={true}
              />
              Include weekends
              <span style={{ color: "#888", fontSize: 12 }}>
                (off = working days only)
              </span>
            </label>
          </div>
        </details>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Send quote
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
  background: "#111",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  flex: 1,
};
