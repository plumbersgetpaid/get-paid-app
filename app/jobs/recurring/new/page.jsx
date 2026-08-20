"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConfirmSendBar from "../../../components/ConfirmSendBar";
import BackButton from "../../../components/BackButton";
import MultiAssignField from "../../../components/MultiAssignField";
import RequestIdField from "../../../components/RequestIdField";

export default function NewRecurringJob() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    fetch("/api/team/list")
      .then((res) => res.json())
      .then((data) => setTeamMembers(data.teamMembers || []))
      .catch((err) => console.error("Load team members error:", err));
  }, []);

  // Called by the ConfirmSendBar after the review card is confirmed (it
  // also handles a plain Enter-key submit via the form's onSubmit below).
  async function submitForm(formEl) {
    setSubmitting(true);
    setError(null);

    const formData = new FormData(formEl);

    try {
      const res = await fetch("/api/jobs/recurring/create", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong saving this.");
        setSubmitting(false);
        return;
      }

      // Replace this page in the browser's history with the destination,
      // so pressing Back afterwards skips straight past this form to
      // wherever the tradie actually came from - not back into a
      // just-submitted form
      router.replace("/jobs/recurring");
    } catch (err) {
      console.error("Recurring job save error:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/jobs/recurring" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Recurring job</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        Set this up once and it'll automatically appear on the calendar on a
        repeating schedule - no need to re-create it each time.
      </p>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitForm(e.target);
        }}
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <RequestIdField />
        <input name="name" placeholder="Customer name" required style={inputStyle} />
        <input name="phone" placeholder="Phone (optional)" style={inputStyle} />
        <input name="email" type="email" placeholder="Email (optional)" style={inputStyle} />
        <input name="jobType" placeholder="Job type (e.g. Boiler service)" style={inputStyle} />
        <input name="location" placeholder="Job location / address (optional)" style={inputStyle} />
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Price (£) - what to charge each time"
          style={inputStyle}
        />

        <label style={{ fontSize: 13, color: "#666" }}>
          First occurrence
          <input
            type="date"
            name="startDate"
            defaultValue={today}
            required
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Preferred start time
          <input
            type="time"
            name="preferredTime"
            defaultValue="09:00"
            required
            style={{ ...inputStyle, marginTop: 6 }}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            Only used if you're not confirming the time closer to each
            occurrence (below)
          </span>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
            background: "white",
            padding: 12,
            borderRadius: 2,
          }}
        >
          <input type="checkbox" name="confirmTimeLater" value="1" />
          I'll confirm the exact time closer to each occurrence, rather than
          fixing it now
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Repeats every
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <input
              type="number"
              name="frequencyValue"
              min="1"
              defaultValue="1"
              required
              style={{ ...inputStyle, flex: 1 }}
            />
            <select name="frequencyUnit" defaultValue="months" style={{ ...inputStyle, flex: 2 }}>
              <option value="weeks">Week(s)</option>
              <option value="months">Month(s)</option>
              <option value="years">Year(s)</option>
            </select>
          </div>
          <span style={{ fontSize: 12, color: "#888" }}>
            e.g. every 3 months for quarterly, every 12 months for yearly
          </span>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>
            Let the client know each time (if you've added their email above)
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="notifyEmail" value="1" defaultChecked />
            Email
          </label>
        </div>

        <label style={{ fontSize: 13, color: "#666" }}>
          Assign to
          <div style={{ marginTop: 6 }}>
            <MultiAssignField teamMembers={teamMembers} />
          </div>
        </label>

        <ConfirmSendBar
          variant="recurring"
          cancelHref="/jobs/recurring"
          submitLabel="Save recurring job"
          confirmLabel="Confirm & save"
          busy={submitting}
          onConfirm={submitForm}
        />
      </form>
    </main>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
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

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
  marginTop: 12,
};
