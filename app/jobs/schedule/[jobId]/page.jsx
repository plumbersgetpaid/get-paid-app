import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { formatCurrency } from "../../../lib/formatCurrency";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything, canReschedule } from "../../../lib/permissions";
import { canAccessJob } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import BackButton from "../../../components/BackButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import VoiceScheduleAssist from "./VoiceScheduleAssist";
import RequestIdField from "../../../components/RequestIdField";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ScheduleJob(props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { jobId } = params;

  // Fetched ahead of the job itself now - the scoped client needs to
  // know who's logged in (and their business) before it can even be
  // constructed, so this can no longer come after the job lookup the
  // way it originally did.
  const currentMember = await getCurrentTeamMember();

  // Gated by the specific can_reschedule permission now, not blanket
  // owner/manager status - an individual subcontractor can be granted
  // this. showEverything below stays tied to the broader
  // canSeeEverything check, since it still governs price visibility on
  // this page - being allowed to reschedule doesn't also mean seeing
  // every price, since that's not one of the six granular permissions.
  const showEverything = canSeeEverything(currentMember);
  if (!canReschedule(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);

  const { data: job, error: jobError } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    notFound();
  }

  // can_reschedule alone only means this person is trusted to reschedule
  // in general - it was never actually checking whether they're assigned
  // to or shared on this specific job, meaning a subcontractor could
  // reschedule any job in the business regardless of assignment. Same
  // shared check used everywhere else a job's own access needs
  // confirming: owner/manager, the direct assignee, or anyone it's
  // been shared with.
  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
    notFound();
  }

  const { data: customer } = await db
    .from("customers")
    .select("name, email, phone")
    .eq("id", job.customer_id)
    .single();

  const settings = await getBusinessSettings();

  // Defaults: tomorrow at 9am for 2 hours, unless we're coming back from a
  // double-booking warning (keep what was entered) or the job's already
  // got a scheduled time saved
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
      // The original weeks/days/hours choice is never actually stored -
      // only the raw start/end timestamps are. Re-deriving this always as
      // "hours" (e.g. "480 hours" for what was booked as "2 weeks") is
      // technically correct but unreadable, so show it in whichever
      // sensible unit divides the gap evenly, falling back to hours only
      // if nothing bigger fits cleanly.
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
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Book this job in</h1>
      </div>

      <section style={summaryCardStyle}>
        <div style={{ fontWeight: 500 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {job.job_type || "Job"}
          {showEverything && <> · {formatCurrency(job.amount, settings.currency)}</>}
        </div>
        {job.time_confirmed === false && (
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, fontWeight: 500 }}>
            Time not yet confirmed - set the real time below
          </div>
        )}
      </section>

      {conflictMessage && (
        <div style={warningBoxStyle}>
          {conflictMessage} You can still book it in anyway if that's fine.
        </div>
      )}

      <form
        action="/api/jobs/schedule"
        method="POST"
        style={{ display: "grid", gap: 12 }}
      >
        <RequestIdField />
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
            borderRadius: 2,
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
          <div style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>
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

const summaryCardStyle = {
  background: "white",
  borderRadius: 3,
  padding: 16,
  margin: "16px 0",
  border: "1px solid #e2e2e2",
};

const locationInputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

const warningBoxStyle = {
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
  marginBottom: 12,
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
