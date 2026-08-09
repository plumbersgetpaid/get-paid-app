import { supabaseAdmin } from "../../../lib/supabaseClient";
import Link from "next/link";
import { notFound } from "next/navigation";
import VoiceScheduleAssist from "./VoiceScheduleAssist";

export const dynamic = "force-dynamic";

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

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .eq("id", job.customer_id)
    .single();

  // Defaults: tomorrow at 9am for 2 hours, unless we're coming back from a
  // double-booking warning (keep what was entered) or the job's already
  // got a scheduled time saved
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  let initialDate = searchParams?.startDate || defaultDate;
  let initialTime = searchParams?.startTime || "09:00";
  let initialDuration = searchParams?.durationHours || "2";

  if (!searchParams?.startDate && job.scheduled_start) {
    const existingStart = new Date(job.scheduled_start);
    initialDate = existingStart.toISOString().slice(0, 10);
    initialTime = existingStart.toISOString().slice(11, 16);
    if (job.scheduled_end) {
      const hours =
        (new Date(job.scheduled_end) - existingStart) / (1000 * 60 * 60);
      initialDuration = String(hours);
    }
  }

  const conflictMessage = searchParams?.conflict;

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Book this job in</h1>
      </div>

      <section style={summaryCardStyle}>
        <div style={{ fontWeight: 600 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {job.job_type || "Job"} · £{job.amount}
        </div>
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
        />

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/" style={cancelButtonStyle}>
            Cancel
          </Link>
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
