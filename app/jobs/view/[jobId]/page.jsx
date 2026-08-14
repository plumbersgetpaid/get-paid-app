import { supabaseAdmin } from "../../../lib/supabaseClient";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { canAccessJob } from "../../../lib/jobAccess";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { formatCurrency } from "../../../lib/formatCurrency";
import BackButton from "../../../components/BackButton";
import AssignAndShareControl from "../../../components/AssignAndShareControl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function deriveJobStatus(job, now) {
  if (["complete", "invoiced", "paid"].includes(job.status)) {
    return { label: "Finished", color: "#16a34a" };
  }
  if (!job.scheduled_start) {
    return { label: "Not yet booked in", color: "#b45309" };
  }
  const start = new Date(job.scheduled_start);
  const end = job.scheduled_end ? new Date(job.scheduled_end) : null;
  if (start > now) {
    return { label: "Upcoming", color: "#2563eb" };
  }
  if (job.time_confirmed !== false && end && end < now) {
    return { label: "Running late", color: "#dc2626" };
  }
  return { label: "In progress", color: "#16a34a" };
}

function describeCompletion(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `~${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} today`
    : end.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function describeDuration(startIso, endIso) {
  const hours = (new Date(endIso) - new Date(startIso)) / (1000 * 60 * 60);
  if (hours <= 0) return null;
  if (hours % (24 * 7) === 0) {
    const weeks = hours / (24 * 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const roundedHours = Math.round(hours * 4) / 4;
  return `${roundedHours} hour${roundedHours === 1 ? "" : "s"}`;
}

export default async function ViewJob({ params }) {
  const { jobId } = params;
  const db = supabaseAdmin();

  const { data: job, error } = await db.from("jobs").select("*").eq("id", jobId).single();
  if (error || !job) {
    notFound();
  }

  const currentMember = await getCurrentTeamMember();
  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
    notFound();
  }

  const showEverything = canSeeEverything(currentMember);
  const settings = await getBusinessSettings();

  const { data: customer } = await db
    .from("customers")
    .select("*")
    .eq("id", job.customer_id)
    .single();

  const { data: allTeamMembers } = await db
    .from("team_members")
    .select("id, name")
    .eq("is_active", true);
  const assigneeIds = new Set();
  if (job.assigned_to) assigneeIds.add(job.assigned_to);
  const { data: shares } = await db
    .from("job_shares")
    .select("team_member_id")
    .eq("job_id", jobId);
  for (const s of shares || []) assigneeIds.add(s.team_member_id);
  const assignees = (allTeamMembers || []).filter((m) => assigneeIds.has(m.id));
  const assigneeNames = assignees.map((m) => m.name);

  const durationLabel =
    job.scheduled_start && job.scheduled_end
      ? describeDuration(job.scheduled_start, job.scheduled_end)
      : null;
  const completionLabel =
    job.scheduled_start && job.scheduled_end
      ? describeCompletion(job.scheduled_start, job.scheduled_end)
      : null;
  const status = deriveJobStatus(job, new Date());

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Job details</h1>
      </div>

      <section style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>{customer?.name || "Customer"}</div>
        {customer?.phone && (
          <a href={`tel:${customer.phone}`} style={contactLinkStyle}>
            📞 {customer.phone}
          </a>
        )}
        {customer?.email && (
          <a href={`mailto:${customer.email}`} style={contactLinkStyle}>
            ✉️ {customer.email}
          </a>
        )}
        {!customer?.phone && !customer?.email && (
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            No contact details on file
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>
          {job.job_type || "Job"}
        </div>

        <div style={rowStyle}>
          <span style={rowLabelStyle}>Status</span>
          <span style={{ ...rowValueStyle, color: status.color }}>{status.label}</span>
        </div>

        {job.location && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>📍 Location</span>
            <span style={rowValueStyle}>{job.location}</span>
          </div>
        )}

        {job.scheduled_start ? (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>📅 Starts</span>
            <span style={rowValueStyle}>
              {job.time_confirmed === false
                ? `${new Date(job.scheduled_start).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })} · time to be confirmed`
                : new Date(job.scheduled_start).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </span>
          </div>
        ) : (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>📅 Starts</span>
            <span style={rowValueStyle}>Not yet booked in</span>
          </div>
        )}

        {durationLabel && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>⏱ Expected duration</span>
            <span style={rowValueStyle}>{durationLabel}</span>
          </div>
        )}

        {completionLabel && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>🏁 Expected completion</span>
            <span style={rowValueStyle}>{completionLabel}</span>
          </div>
        )}

        {showEverything ? (
          <div style={{ padding: "10px 0", borderBottom: "1px solid #f2f2f2" }}>
            <div style={{ ...rowLabelStyle, fontSize: 14, marginBottom: 6 }}>👤 Assigned to</div>
            <AssignAndShareControl
              jobId={job.id}
              initialAssignees={assignees}
              teamMembers={allTeamMembers || []}
            />
          </div>
        ) : (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>👤 Assigned to</span>
            <span style={rowValueStyle}>
              {assigneeNames.length > 0 ? assigneeNames.join(", ") : "Unassigned"}
            </span>
          </div>
        )}

        {showEverything && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>💷 Price</span>
            <span style={rowValueStyle}>{formatCurrency(job.amount, settings.currency)}</span>
          </div>
        )}

        {job.completion_note && (
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <span style={rowLabelStyle}>📝 Completion note</span>
            <span style={rowValueStyle}>{job.completion_note}</span>
          </div>
        )}
      </section>

      <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
        <a href={`/jobs/notes/${job.id}`} style={secondaryButtonStyle}>
          📝 Job notes
        </a>
        {showEverything && job.status === "in_progress" && (
          <>
            <a href={`/jobs/schedule/${job.id}`} style={secondaryButtonStyle}>
              {job.scheduled_start ? "Reschedule" : "Book in"}
            </a>
            <a href={`/jobs/complete/${job.id}?from=work`} style={primaryButtonStyle}>
              Mark done
            </a>
          </>
        )}
      </div>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const contactLinkStyle = {
  display: "block",
  fontSize: 14,
  color: "#2563eb",
  textDecoration: "none",
  marginTop: 6,
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #f2f2f2",
  fontSize: 14,
};

const rowLabelStyle = {
  color: "#888",
  flexShrink: 0,
};

const rowValueStyle = {
  color: "#111",
  fontWeight: 600,
  textAlign: "right",
};

const secondaryButtonStyle = {
  display: "block",
  textAlign: "center",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "14px",
  borderRadius: 10,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 15,
};

const primaryButtonStyle = {
  display: "block",
  textAlign: "center",
  background: "#16a34a",
  color: "white",
  border: "none",
  padding: "14px",
  borderRadius: 10,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 15,
};
