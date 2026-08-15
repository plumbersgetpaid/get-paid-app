import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { formatCurrency } from "../../../lib/formatCurrency";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything, canReschedule } from "../../../lib/permissions";
import BackButton from "../../../components/BackButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import VoiceScheduleAssist from "./VoiceScheduleAssist";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ScheduleJob({ params, searchParams }) {
  const { jobId } = params;
  const db = supabaseAdmin();

  const { data: job, error: jobError } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    notFound();
  }

  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);
  if (!canReschedule(currentMember)) {
    notFound();
  }

  const { data: customer } = await db
    .from("customers")
    .select("name, email, phone")
    .eq("id", job.customer_id)
    .single();

  const settings = await getBusinessSettings();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  let initialDate = searchParams?.startDate || defaultDate;
  let initialTime = searchParams?.startTime || "09:00";
  let initialDuration = searchParams?.durationValue || "2";
  let initialDurationUnit = searchParams?.durationUnit || "hours";

  if (!searchParams?.startDate && job.scheduled_start) {
    const existingStart = new Date(job.scheduled_start);
    initialDate = existingStart.toISOString().slice(0, 10);
    initialTime = existingStart.toISOString().slice(11, 16);
    if (job.scheduled_end) {
      const hours = (new Date(job.scheduled_end) - existingStart) / (1000 * 60 * 60);
      if (hours % (24 * 7) === 0) {
        initialDuration = String(hours / (24 * 7));
        initialDurationUnit = "weeks";
      } else if (hours % 24 === 0) {
        initialDuration = String(hours / 24);
        initialDurationUnit = "days";
      } else {
        initialDuration = String(hours);
        initialDurationUnit = "hours";
      }
    }
  }

  const conflictMessage = searchParams?.conflict;
  const initialLocation = searchParams?.location ?? job.location ?? "";
  const initialIncludeWeekends =
    searchParams?.includeWeekends !== undefined
      ? searchParams.includeWeekends === "1"
      : true;

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Book this job in</h1>
      </div>

      <section style={summaryCardStyle}>
        <div style={{ fontWeight: 600 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {job.job_type || "Job"}
          {showEverything && <> · {formatCurrency(job.amount, settings.currency)}</>}
        </div>
        {job.time_confirmed === false && (
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, fontWeight: 600 }}>
            ⏰ Time not yet confirmed - set the real time below
          </div>
        )}
      </section>

      {conflictMessage && (
        <div style={warningBoxStyle}>
          ⚠️ {conflictMessage} You can still book it in anyway if that's fine.
        </div>
      )}

      <form
        action="/api/jobs/schedule"
        method="POST"
        style={{ display: "grid", gap: 12 }}
      >
        <input type="hidden" name="jobId" value={job.id} />
        {conflictMessage && <input type="hidden" name="force" value="1" />}

        <VoiceScheduleAssist
          initialDate={initialDate}
          initialTime={initialTime}
          initialDuration={initialDuration}
          initialDurationUnit={initialDurationUnit}
        />

        <input
          name="location"
          placeholder="Job location / address (optional)"
          defaultValue={initialLocation}
          style={locationInputStyle}
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
            (off = counts working days only, e.g. "1 week" = 5 days)
          </span>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: "#666", fontWeight: 600 }}>
            Let the client know
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              name="notifyEmail"
              value="1"
              defaultChecked={!!customer?.email}
              disabled={!customer?.email}
            />
            Email
            {!customer?.email && (
              <span style={{ color: "#888", fontSize: 12 }}>(no email on file)</span>
            )}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              name="notifyWhatsapp"
              value="1"
              defaultChecked={!!customer?.phone}
              disabled={!customer?.phone}
            />
            WhatsApp
            {!customer?.phone && (
              <span style={{ color: "#888", fontSize: 12 }}>(no phone on file)</span>
            )}
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <BackButton fallbackHref="/work?tab=jobs" style={cancelButtonStyle}>
            Cancel
          </BackButton>
          <button type="submit" style={submitButtonStyle}>
            {conflictMessage ? "Book anyway" : "Confirm booking"}
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

const summaryCardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const locationInputStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

const warningBoxStyle = {
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 12,
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
