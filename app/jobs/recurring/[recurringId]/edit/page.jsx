import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canCreateRecurringJob } from "../../../../lib/permissions";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import BackButton from "../../../../components/BackButton";
import MultiAssignField from "../../../../components/MultiAssignField";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function EditRecurringJob({ params }) {
  const currentMember = await getCurrentTeamMember();
  if (!canCreateRecurringJob(currentMember)) {
    notFound();
  }

  const { recurringId } = params;
  const db = await getScopedDb(currentMember);

  const { data: recurring, error } = await db
    .from("recurring_jobs")
    .select("*")
    .eq("id", recurringId)
    .single();

  if (error || !recurring) {
    notFound();
  }

  const { data: teamMembersData } = await db
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const teamMembers = teamMembersData || [];

  // Combines the legacy single assigned_to with recurring_job_shares
  // into one starting set for the tick-box field - same pattern as
  // regular jobs, so this form shows everyone currently on it
  const currentAssigneeIds = new Set();
  if (recurring.assigned_to) currentAssigneeIds.add(recurring.assigned_to);
  const { data: recurringShares } = await db
    .from("recurring_job_shares")
    .select("team_member_id")
    .eq("recurring_job_id", recurringId);
  for (const s of recurringShares || []) {
    currentAssigneeIds.add(s.team_member_id);
  }

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .eq("id", recurring.customer_id)
    .single();

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/jobs/recurring" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Edit recurring job</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        For {customer?.name || "this customer"} - changes here apply to
        future occurrences, not ones already booked in.
      </p>

      <form
        action="/api/jobs/recurring/update"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <input type="hidden" name="recurringId" value={recurring.id} />

        <input
          name="jobType"
          placeholder="Job type"
          defaultValue={recurring.job_type || ""}
          style={inputStyle}
        />
        <input
          name="location"
          placeholder="Job location / address (optional)"
          defaultValue={recurring.location || ""}
          style={inputStyle}
        />
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Price"
          defaultValue={recurring.amount || ""}
          style={inputStyle}
        />

        <label style={{ fontSize: 13, color: "#666" }}>
          Preferred start time
          <input
            type="time"
            name="preferredTime"
            defaultValue={recurring.preferred_time || "09:00"}
            style={{ ...inputStyle, marginTop: 6 }}
          />
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
          <input
            type="checkbox"
            name="confirmTimeLater"
            value="1"
            defaultChecked={recurring.confirm_time_later}
          />
          I'll confirm the exact time closer to each occurrence, rather than
          fixing it
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Repeats every
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <input
              type="number"
              name="frequencyValue"
              min="1"
              defaultValue={recurring.frequency_value}
              required
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              name="frequencyUnit"
              defaultValue={recurring.frequency_unit}
              style={{ ...inputStyle, flex: 2 }}
            >
              <option value="weeks">Week(s)</option>
              <option value="months">Month(s)</option>
              <option value="years">Year(s)</option>
            </select>
          </div>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>
            Let the client know each time
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              name="notifyEmail"
              value="1"
              defaultChecked={recurring.notify_email}
            />
            Email
          </label>
        </div>

        <label style={oneOffCardStyle}>
          <div style={{ fontWeight: 500, fontSize: 13, color: "#92400e" }}>
            One-off: I already know the time for the very next occurrence
            only
          </div>
          <input
            type="time"
            name="nextOccurrenceTime"
            defaultValue={recurring.next_occurrence_time || ""}
            style={{ ...inputStyle, marginTop: 8 }}
          />
          <span style={{ fontSize: 12, color: "#92400e" }}>
            Leave blank to use the usual settings above. If filled in, it
            only affects the next occurrence - after that, this clears
            itself and things go back to normal.
          </span>
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Assign to
          <div style={{ marginTop: 6 }}>
            <MultiAssignField
              teamMembers={teamMembers}
              initialSelectedIds={[...currentAssigneeIds]}
            />
          </div>
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/jobs/recurring" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Save changes
          </button>
        </div>
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

const oneOffCardStyle = {
  display: "block",
  background: "#fef3c7",
  border: "1px solid #fde68a",
  borderRadius: 2,
  padding: 12,
};
