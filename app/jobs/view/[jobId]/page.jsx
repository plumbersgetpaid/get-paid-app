import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything, canReschedule, canInvoice } from "../../../lib/permissions";
import { canAccessJob } from "../../../lib/jobAccess";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { formatCurrency } from "../../../lib/formatCurrency";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import BackButton from "../../../components/BackButton";
import AssignAndShareControl from "../../../components/AssignAndShareControl";
import DeleteJobButton from "../../../components/DeleteJobButton";
import ConfirmSubmitButton from "../../../components/ConfirmSubmitButton";
import ReloadOnBack from "../../../components/ReloadOnBack";
import { nowInLondonFrame } from "../../../lib/today";
import { EMAIL_KIND_LABELS } from "../../../lib/logEmail";
import { supabaseAdmin } from "../../../lib/supabaseClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Combines the DB lifecycle status (in_progress vs complete/invoiced/paid)
// with scheduling to get to the 5 states that actually matter at a
// glance: whether it's finished, not yet booked in, upcoming, currently
// running, or overdue. Verified against 9 scenarios before wiring in,
// including the edge cases (unconfirmed time never counts as late,
// starting exactly now counts as in progress not upcoming).
function deriveJobStatus(job, now) {
  if (job.status === "cancelled") {
    return { label: "Cancelled", color: "#6b7280" };
  }
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

// Same same-day-vs-multi-day distinction already used on Calendar for
// consistency - "finishes ~3:45pm" reads better for a same-day job than
// repeating today's date, while a multi-day job needs the actual date
function describeCompletion(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `~${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} today`
    : end.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// Expresses a scheduled_start/scheduled_end gap in whichever unit divides
// it evenly - "2 weeks" reads far better than "336 hours" - falling back
// to hours only when nothing bigger fits cleanly. Same approach already
// used on the Schedule page for re-deriving a duration from raw timestamps.
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

export default async function ViewJob(props) {
  const params = await props.params;
  const { jobId } = params;
  // Fetched ahead of the job itself now - the scoped client needs to
  // know who's logged in (and their business) before it can even be
  // constructed, so this can no longer come after the job lookup the
  // way it originally did. These two steps don't depend on each other,
  // so reordering them changes nothing else about how this page behaves.
  const currentMember = await getCurrentTeamMember();
  const db = await getScopedDb(currentMember);

  const { data: job, error } = await db.from("jobs").select("*").eq("id", jobId).single();
  if (error || !job) {
    notFound();
  }

  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
    notFound();
  }

  const showEverything = canSeeEverything(currentMember);
  const settings = await getBusinessSettings();

  // Whether this job has an invoice determines what owner/manager can do
  // with it below - a job with real financial history attached is never
  // deletable, only cancellable, so nothing about the invoice trail can
  // ever silently disappear
  const { data: existingInvoice } = showEverything
    ? await db.from("invoices").select("id").eq("job_id", jobId).maybeSingle()
    : { data: null };

  const { data: customer } = await db
    .from("customers")
    .select("*")
    .eq("id", job.customer_id)
    .single();

  // Combines the legacy single assigned_to column with job_shares into
  // one list - same pattern used everywhere else assignment is shown,
  // so this page stays consistent with Work → Jobs. Kept as full
  // {id, name} objects, not just names, since owner/manager get the
  // actual editable AssignAndShareControl here, not just a read-out.
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

  // Every email the app has sent the customer about this job - the
  // tradesperson has no Sent folder (mail goes out from the platform
  // address), so this is their proof of what was actually sent, and when.
  // Two sources merged: email_log (quote, booking, invoice, follow-up,
  // review) and chase_log (invoice payment chasers, keyed via the invoice).
  //
  // email_log is service-role-only (RLS locked, like processed_requests),
  // so this read uses the admin client - scoped explicitly by business_id
  // AND job_id, and only after the scoped job fetch above already proved
  // this member can access this job. Standing service-role rule applies.
  const { data: emailRows } = await supabaseAdmin()
    .from("email_log")
    .select("kind, subject, sent_at, email_to")
    .eq("business_id", currentMember.business_id)
    .eq("job_id", jobId)
    .order("sent_at", { ascending: false });
  const { data: jobInvoices } = await db
    .from("invoices")
    .select("id")
    .eq("job_id", jobId);
  const invoiceIds = (jobInvoices || []).map((i) => i.id);
  const { data: chaseRows } = invoiceIds.length
    ? await db
        .from("chase_log")
        .select("sent_at")
        .in("invoice_id", invoiceIds)
        .eq("channel", "email")
    : { data: [] };
  const sentEmails = [
    ...(emailRows || []).map((e) => ({
      label: EMAIL_KIND_LABELS[e.kind] || "Email",
      sentAt: e.sent_at,
      to: e.email_to,
    })),
    ...(chaseRows || []).map((c) => ({
      label: "Payment reminder",
      sentAt: c.sent_at,
      to: customer?.email || null,
    })),
  ]
    .filter((e) => e.sentAt)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  const durationLabel =
    job.scheduled_start && job.scheduled_end
      ? describeDuration(job.scheduled_start, job.scheduled_end)
      : null;
  const completionLabel =
    job.scheduled_start && job.scheduled_end
      ? describeCompletion(job.scheduled_start, job.scheduled_end)
      : null;
  const status = deriveJobStatus(job, nowInLondonFrame());

  return (
    <main>
      <ReloadOnBack />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Job details</h1>
      </div>

      <section style={cardStyle}>
        <div style={{ fontWeight: 500, fontSize: 17 }}>{customer?.name || "Customer"}</div>
        {customer?.phone && (
          <a href={`tel:${customer.phone}`} style={contactLinkStyle}>
            {customer.phone}
          </a>
        )}
        {customer?.email && (
          <a href={`mailto:${customer.email}`} style={contactLinkStyle}>
            {customer.email}
          </a>
        )}
        {!customer?.phone && !customer?.email && (
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            No contact details on file
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 10 }}>
          {job.job_type || "Job"}
        </div>

        <div style={rowStyle}>
          <span style={rowLabelStyle}>Status</span>
          <span style={{ ...rowValueStyle, color: status.color }}>{status.label}</span>
        </div>

        {job.location && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Location</span>
            <span style={rowValueStyle}>{job.location}</span>
          </div>
        )}

        {job.scheduled_start ? (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Starts</span>
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
            <span style={rowLabelStyle}>Starts</span>
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
            <span style={rowLabelStyle}>Expected completion</span>
            <span style={rowValueStyle}>{completionLabel}</span>
          </div>
        )}

        {showEverything ? (
          <div style={{ padding: "10px 0", borderBottom: "1px solid #f2f2f2" }}>
            <div style={{ ...rowLabelStyle, fontSize: 14, marginBottom: 6 }}>Assigned to</div>
            <AssignAndShareControl
              jobId={job.id}
              initialAssignees={assignees}
              teamMembers={allTeamMembers || []}
            />
          </div>
        ) : (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Assigned to</span>
            <span style={rowValueStyle}>
              {assigneeNames.length > 0 ? assigneeNames.join(", ") : "Unassigned"}
            </span>
          </div>
        )}

        {showEverything && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Price</span>
            <span style={rowValueStyle}>{formatCurrency(job.amount, settings.currency)}</span>
          </div>
        )}

        {job.completion_note && (
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <span style={rowLabelStyle}>Completion note</span>
            <span style={rowValueStyle}>{job.completion_note}</span>
          </div>
        )}
      </section>

      <section style={{ ...cardStyle, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
          Emails sent to the customer
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 10px" }}>
          Sent for you from PatchUp&apos;s address, with replies going to your
          own email - so they won&apos;t show in your Sent folder. This is the
          record of what&apos;s gone out.
        </p>
        {sentEmails.length === 0 ? (
          <div style={{ fontSize: 13, color: "#888" }}>
            Nothing emailed for this job yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sentEmails.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 13,
                  borderBottom: i < sentEmails.length - 1 ? "1px solid #f0f0f0" : "none",
                  paddingBottom: i < sentEmails.length - 1 ? 8 : 0,
                }}
              >
                <span>
                  <span style={{ fontWeight: 500 }}>{e.label}</span>
                  {e.to && (
                    <span style={{ color: "#888" }}> · to {e.to}</span>
                  )}
                </span>
                {/* sent_at is a real UTC instant (unlike scheduled times,
                    which are London-wall-clock) - so it needs an explicit
                    London timeZone or BST times render an hour off */}
                <span style={{ color: "#888", whiteSpace: "nowrap" }}>
                  {new Date(e.sentAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Europe/London",
                  })}{" "}
                  {new Date(e.sentAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/London",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
        <a href={`/jobs/notes/${job.id}`} style={secondaryButtonStyle}>
          Job notes
        </a>
        {canReschedule(currentMember) && job.status === "in_progress" && (
          <a href={`/jobs/schedule/${job.id}`} style={secondaryButtonStyle}>
            {job.scheduled_start ? "Reschedule" : "Book in"}
          </a>
        )}
        {canInvoice(currentMember) && job.status === "in_progress" && (
          <a href={`/jobs/complete/${job.id}?from=work`} style={primaryButtonStyle}>
            Mark done
          </a>
        )}

        {showEverything && !existingInvoice && <DeleteJobButton jobId={job.id} />}

        {showEverything && existingInvoice && job.status !== "cancelled" && (
          <form action="/api/jobs/cancel" method="POST">
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="from" value="work" />
            <ConfirmSubmitButton
              style={cancelButtonStyle}
              confirmText="Cancel this job? The invoice raised against it stays on record, but if it's unpaid PatchUp will stop chasing it and it won't count as money you're owed."
              confirmLabel="Yes, cancel the job"
              cancelLabel="Leave it as is"
            >
              Cancel this job
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      {showEverything && !existingInvoice && (
        <p style={{ fontSize: 12, color: "#888", marginTop: 8, textAlign: "center" }}>
          No invoice attached yet, so this can be deleted outright - once
          invoiced, it can only be cancelled, not removed.
        </p>
      )}
      {showEverything && existingInvoice && job.status !== "cancelled" && (
        <p style={{ fontSize: 12, color: "#888", marginTop: 8, textAlign: "center" }}>
          This has an invoice attached, so it can't be deleted - cancelling
          keeps it and the invoice on record, just out of your active jobs.
          If the invoice is unpaid, cancelling also stops the automatic
          payment reminders.
        </p>
      )}
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: "var(--card-pad, 16px)",
  margin: "16px 0",
  border: "1px solid #e2e2e2",
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
  color: "#000",
  fontWeight: 500,
  textAlign: "right",
};

const secondaryButtonStyle = {
  display: "block",
  textAlign: "center",
  background: "white",
  color: "#000",
  border: "1px solid #e2e2e2",
  padding: "14px",
  borderRadius: 2,
  fontWeight: 500,
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
  borderRadius: 2,
  fontWeight: 500,
  textDecoration: "none",
  fontSize: 15,
};

const cancelButtonStyle = {
  width: "100%",
  display: "block",
  textAlign: "center",
  background: "white",
  color: "#92400e",
  border: "1px solid #fde68a",
  padding: "14px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 15,
};
