import { supabaseAdmin } from "../lib/supabaseClient";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getTodayInLondon } from "../lib/today";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything } from "../lib/permissions";
import { filterJobsForMember } from "../lib/jobAccess";
import AssignJobDropdown from "../components/AssignJobDropdown";
import ShareJobControl from "../components/ShareJobControl";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Work({ searchParams }) {
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);
  const tab = searchParams?.tab || (showEverything ? "quotes" : "jobs");

  return (
    <main>
      <h1 style={{ fontSize: 20, margin: "0 0 16px" }}>Work</h1>

      <div style={tabRowStyle}>
        {showEverything && (
          <Link href="/work?tab=quotes" style={tabStyle(tab === "quotes")}>
            Quotes
          </Link>
        )}
        <Link href="/work?tab=jobs" style={tabStyle(tab === "jobs")}>
          Jobs
        </Link>
        {showEverything && (
          <Link href="/work?tab=invoices" style={tabStyle(tab === "invoices")}>
            Invoices
          </Link>
        )}
      </div>

      {tab === "quotes" && showEverything && (
        <QuotesTab db={db} settings={settings} sub={searchParams?.sub || "waiting"} />
      )}
      {tab === "jobs" && (
        <JobsTab
          db={db}
          settings={settings}
          sub={searchParams?.sub || "today"}
          currentMember={currentMember}
          showEverything={showEverything}
        />
      )}
      {tab === "invoices" && showEverything && (
        <InvoicesTab db={db} settings={settings} sub={searchParams?.sub || "overdue"} />
      )}
    </main>
  );
}

async function QuotesTab({ db, settings, sub }) {
  const activeSub = ["waiting", "chased"].includes(sub) ? sub : "waiting";

  const { data: rawQuotes } = await db
    .from("jobs")
    .select("*")
    .eq("status", "quote_sent")
    .order("quote_sent_at", { ascending: true });

  let quotes = rawQuotes || [];
  const customerIds = [...new Set(quotes.map((q) => q.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));

  const creatorIds = [...new Set(quotes.map((q) => q.created_by).filter(Boolean))];
  const { data: creators } = creatorIds.length
    ? await db.from("team_members").select("id, name").in("id", creatorIds)
    : { data: [] };
  const creatorNameById = Object.fromEntries((creators || []).map((c) => [c.id, c.name]));

  quotes = quotes.map((q) => ({
    ...q,
    customer_name: nameById[q.customer_id] || "Unknown customer",
    creator_name: creatorNameById[q.created_by] || null,
  }));

  const waitingQuotes = quotes.filter((q) => !q.quote_chased_at);
  const chasedQuotes = quotes.filter((q) => q.quote_chased_at);
  const activeList = activeSub === "chased" ? chasedQuotes : waitingQuotes;

  const subTabs = [
    { key: "waiting", label: "Waiting response", count: waitingQuotes.length },
    { key: "chased", label: "Already chased", count: chasedQuotes.length },
  ];

  return (
    <div>
      <div style={subTabRowStyle}>
        {subTabs.map((t) => (
          <Link
            key={t.key}
            href={`/work?tab=quotes&sub=${t.key}`}
            style={subTabStyle(activeSub === t.key)}
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      <form action="/jobs" method="GET" style={searchFormStyle}>
        <input type="hidden" name="status" value="quote_sent" />
        <input type="search" name="q" placeholder="Search quotes" style={searchInputStyle} />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {activeList.length === 0 && (
        <p style={{ color: "#888" }}>
          {activeSub === "chased" ? "No quotes chased yet." : "No quotes waiting on a reply."}
        </p>
      )}

      {activeList.slice(0, 8).map((q) => {
        const sentDate = q.quote_sent_at ? new Date(q.quote_sent_at) : null;
        const daysSince = sentDate
          ? Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const sentLabel =
          daysSince === null
            ? null
            : daysSince === 0
            ? "Sent today"
            : daysSince === 1
            ? "Sent 1 day ago"
            : `Sent ${daysSince} days ago`;
        const worthChasing = daysSince !== null && daysSince >= 3 && !q.quote_chased_at;

        return (
          <div key={q.id} style={cardStyle("#f59e0b")}>
            <div style={{ fontWeight: 600 }}>{q.customer_name}</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>
              {q.job_type || "Job"} · {formatCurrency(q.amount, settings.currency)}
              {q.creator_name && <> · quoted by {q.creator_name}</>}
            </div>
            {sentLabel && (
              <div
                style={{
                  fontSize: 12,
                  color: worthChasing ? "#b45309" : "#888",
                  fontWeight: worthChasing ? 700 : 400,
                  marginBottom: 10,
                }}
              >
                {worthChasing ? "⏰ " : ""}
                {sentLabel}
                {q.quote_chased_at ? " · already chased" : ""}
                {worthChasing ? " · worth chasing" : ""}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <form action="/api/jobs/accept-quote" method="POST" style={{ flex: 1 }}>
                <input type="hidden" name="jobId" value={q.id} />
                <button type="submit" style={primaryButtonStyle}>
                  Accept quote
                </button>
              </form>
              <form action="/api/jobs/chase-quote" method="POST" style={{ flex: 1 }}>
                <input type="hidden" name="jobId" value={q.id} />
                <button type="submit" style={secondaryButtonStyle}>
                  Chase quote
                </button>
              </form>
            </div>
            <form action="/api/jobs/decline-quote" method="POST" style={{ marginTop: 6 }}>
              <input type="hidden" name="jobId" value={q.id} />
              <button type="submit" style={declineLinkStyle}>
                Decline / lost job
              </button>
            </form>
          </div>
        );
      })}

      {activeList.length > 8 && (
        <Link href="/jobs?status=quote_sent" style={viewAllLinkStyle}>
          View all {quotes.length} quotes →
        </Link>
      )}
    </div>
  );
}

function formatLateness(scheduledEnd) {
  const diffMs = new Date() - new Date(scheduledEnd);
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return "under an hour late";
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return `${hours} hour${hours === 1 ? "" : "s"} late`;
  }
  const days = Math.floor(diffHours / 24);
  return `${days} day${days === 1 ? "" : "s"} late`;
}

async function JobsTab({ db, settings, sub, currentMember, showEverything }) {
  const activeSub = ["today", "upcoming", "unscheduled", "completed"].includes(sub)
    ? sub
    : "today";

  let jobsQuery = db.from("jobs").select("*").eq("status", "in_progress");
  if (!showEverything) {
    jobsQuery = await filterJobsForMember(db, jobsQuery, currentMember?.id);
  }
  const { data: rawJobs } = await jobsQuery;
  let jobs = rawJobs || [];
  const customerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));

  const { data: teamMembersData } = await db
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const teamMembers = teamMembersData || [];
  const teamMemberNameById = Object.fromEntries(teamMembers.map((m) => [m.id, m.name]));

  const jobIdsForShares = jobs.map((j) => j.id);
  const { data: allShares } = jobIdsForShares.length
    ? await db.from("job_shares").select("job_id, team_member_id").in("job_id", jobIdsForShares)
    : { data: [] };
  const sharesByJob = {};
  for (const s of allShares || []) {
    const member = teamMembers.find((m) => m.id === s.team_member_id);
    if (!member) continue;
    (sharesByJob[s.job_id] ||= []).push(member);
  }

  jobs = jobs.map((j) => ({
    ...j,
    customer_name: nameById[j.customer_id] || "Unknown customer",
    creator_name: teamMemberNameById[j.created_by] || null,
  }));

  const todayStr = getTodayInLondon();
  const todayJobs = jobs
    .filter((j) => j.scheduled_start && j.scheduled_start.slice(0, 10) <= todayStr)
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
  const upcomingJobs = jobs
    .filter((j) => j.scheduled_start && j.scheduled_start.slice(0, 10) > todayStr)
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
  const unscheduledJobs = jobs.filter((j) => !j.scheduled_start);

  const { count: completedCount } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["complete", "invoiced", "paid"]);

  let completedJobs = [];
  if (activeSub === "completed") {
    const { data: rawCompleted } = await db
      .from("jobs")
      .select("*")
      .in("status", ["complete", "invoiced", "paid"])
      .order("completed_at", { ascending: false })
      .limit(8);
    const completedCustomerIds = [...new Set((rawCompleted || []).map((j) => j.customer_id))];
    const { data: completedCustomers } = completedCustomerIds.length
      ? await db.from("customers").select("id, name").in("id", completedCustomerIds)
      : { data: [] };
    const completedNameById = Object.fromEntries(
      (completedCustomers || []).map((c) => [c.id, c.name])
    );

    const completedJobIds = (rawCompleted || []).map((j) => j.id);
    const { data: completedInvoices } = completedJobIds.length
      ? await db.from("invoices").select("id, job_id").in("job_id", completedJobIds)
      : { data: [] };
    const invoiceIdByJob = Object.fromEntries(
      (completedInvoices || []).map((inv) => [inv.job_id, inv.id])
    );

    completedJobs = (rawCompleted || []).map((j) => ({
      ...j,
      customer_name: completedNameById[j.customer_id] || "Unknown customer",
      invoice_id: invoiceIdByJob[j.id] || null,
      creator_name: teamMemberNameById[j.created_by] || null,
    }));
  }

  const activeList =
    activeSub === "today"
      ? todayJobs
      : activeSub === "upcoming"
      ? upcomingJobs
      : activeSub === "unscheduled"
      ? unscheduledJobs
      : completedJobs;

  const noteJobIds = [...jobs.map((j) => j.id), ...completedJobs.map((j) => j.id)];
  const { data: noteRows } = noteJobIds.length
    ? await db.from("job_notes").select("job_id, important").in("job_id", noteJobIds)
    : { data: [] };
  const noteCountByJob = {};
  const hasImportantNoteByJob = {};
  for (const n of noteRows || []) {
    noteCountByJob[n.job_id] = (noteCountByJob[n.job_id] || 0) + 1;
    if (n.important) hasImportantNoteByJob[n.job_id] = true;
  }

  const subTabs = [
    { key: "today", label: "Today & overdue", count: todayJobs.length },
    { key: "upcoming", label: "Upcoming", count: upcomingJobs.length },
    { key: "unscheduled", label: "Unscheduled", count: unscheduledJobs.length },
    { key: "completed", label: "Completed", count: completedCount || 0 },
  ];

  return (
    <div>
      <div style={subTabRowStyle}>
        {subTabs.map((t) => (
          <Link
            key={t.key}
            href={`/work?tab=jobs&sub=${t.key}`}
            style={subTabStyle(activeSub === t.key)}
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      <form action="/jobs" method="GET" style={searchFormStyle}>
        <input type="search" name="q" placeholder="Search jobs" style={searchInputStyle} />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      <Link href="/jobs/recurring" style={recurringButtonStyle}>
        🔁 Recurring jobs
      </Link>

      {activeList.length === 0 && (
        <p style={{ color: "#888" }}>Nothing in {subTabs.find((t) => t.key === activeSub).label.toLowerCase()}.</p>
      )}

      {activeList.map((job) => {
        if (activeSub === "completed") {
          return (
            <div key={job.id} style={cardStyle("#16a34a")}>
              <div style={{ fontWeight: 600 }}>{job.customer_name}</div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {job.job_type}
                {showEverything && <> · {formatCurrency(job.amount, settings.currency)}</>} ·{" "}
                <span style={{ textTransform: "capitalize" }}>{job.status}</span>
                {job.creator_name && <> · booked by {job.creator_name}</>}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                {showEverything && job.invoice_id && (
                  <Link href={`/invoices/${job.invoice_id}`} style={jobLinkStyle}>
                    View invoice →
                  </Link>
                )}
                <a
                  href={`/jobs/notes/${job.id}`}
                  style={hasImportantNoteByJob[job.id] ? importantNoteLinkStyle : jobLinkStyle}
                >
                  {hasImportantNoteByJob[job.id] ? "⚠️ " : "📝 "}Notes
                  {noteCountByJob[job.id] ? ` (${noteCountByJob[job.id]})` : ""}
                </a>
              </div>
            </div>
          );
        }

        const isLate =
          job.time_confirmed !== false &&
          job.scheduled_end &&
          new Date(job.scheduled_end) < new Date() &&
          !job.status.startsWith("complete");

        return (
          <div key={job.id} style={cardStyle(isLate ? "#dc2626" : "#2563eb")}>
            <div style={{ fontWeight: 600 }}>{job.customer_name}</div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {job.job_type}
              {showEverything && <> · {formatCurrency(job.amount, settings.currency)}</>}
              {job.creator_name && <> · booked by {job.creator_name}</>}
            </div>
            {isLate ? (
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginTop: 2 }}>
                ⚠️ Running {formatLateness(job.scheduled_end)}
              </div>
            ) : job.time_confirmed === false ? (
              <div style={{ fontSize: 12, color: "#b45309", fontWeight: 700, marginTop: 2 }}>
                📅{" "}
                {new Date(job.scheduled_start).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                · ⏰ time to be confirmed
              </div>
            ) : (
              job.scheduled_start && (
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>
                  📅 Due{" "}
                  {new Date(job.scheduled_start).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <a href={`/jobs/schedule/${job.id}`} style={secondaryLinkButtonStyle}>
                {job.scheduled_start ? "Reschedule" : "Book in"}
              </a>
              <a href={`/jobs/complete/${job.id}?from=work`} style={primaryLinkButtonStyle}>
                Mark done
              </a>
            </div>
            <a
              href={`/jobs/notes/${job.id}`}
              style={hasImportantNoteByJob[job.id] ? importantPhotosLinkButtonStyle : photosLinkButtonStyle}
            >
              {hasImportantNoteByJob[job.id] ? "⚠️ " : "📝 "}Notes
              {noteCountByJob[job.id] ? ` (${noteCountByJob[job.id]})` : ""}
            </a>
            {showEverything && (
              <AssignJobDropdown
                jobId={job.id}
                assignedTo={job.assigned_to}
                teamMembers={teamMembers}
              />
            )}
            <ShareJobControl
              jobId={job.id}
              initialShares={sharesByJob[job.id] || []}
              teamMembers={teamMembers.filter(
                (m) => m.id !== job.assigned_to && m.id !== currentMember?.id
              )}
            />
          </div>
        );
      })}

      {(activeSub === "unscheduled" || activeSub === "completed") && (
        <Link
          href={`/jobs?status=${activeSub === "completed" ? "done" : "unscheduled"}`}
          style={viewAllLinkStyle}
        >
          View all in {subTabs.find((t) => t.key === activeSub).label} →
        </Link>
      )}
    </div>
  );
}

async function InvoicesTab({ db, settings, sub }) {
  const activeSub = ["overdue", "awaiting", "paid"].includes(sub) ? sub : "overdue";

  const { data: outstanding } = await db
    .from("outstanding_invoices")
    .select("*")
    .order("due_date", { ascending: true });

  const overdue = (outstanding || []).filter((i) => i.days_overdue > 0);
  const notYetDue = (outstanding || []).filter((i) => i.days_overdue <= 0);

  const { data: paidInvoicesRaw } = await db
    .from("invoices")
    .select("*")
    .eq("status", "paid")
    .order("paid_at", { ascending: false });
  const paidInvoices = paidInvoicesRaw || [];
  const paidTotal = paidInvoices.reduce((s, i) => s + Number(i.amount), 0);

  let paidPreview = [];
  if (activeSub === "paid") {
    const jobIds = [...new Set(paidInvoices.map((i) => i.job_id))];
    const { data: jobs } = jobIds.length
      ? await db.from("jobs").select("id, job_type, customer_id").in("id", jobIds)
      : { data: [] };
    const jobById = Object.fromEntries((jobs || []).map((j) => [j.id, j]));
    const paidCustomerIds = [...new Set((jobs || []).map((j) => j.customer_id))];
    const { data: paidCustomers } = paidCustomerIds.length
      ? await db.from("customers").select("id, name").in("id", paidCustomerIds)
      : { data: [] };
    const paidNameById = Object.fromEntries((paidCustomers || []).map((c) => [c.id, c.name]));

    paidPreview = paidInvoices.slice(0, 8).map((inv) => {
      const job = jobById[inv.job_id];
      return {
        ...inv,
        job_type: job?.job_type,
        customer_name: job ? paidNameById[job.customer_id] : "Unknown customer",
      };
    });
  }

  const activeList =
    activeSub === "overdue" ? overdue : activeSub === "awaiting" ? notYetDue : paidPreview;

  const subTabs = [
    { key: "overdue", label: "Overdue", count: overdue.length },
    { key: "awaiting", label: "Awaiting", count: notYetDue.length },
    { key: "paid", label: "Paid (all time)", count: paidInvoices.length },
  ];

  return (
    <div>
      <Link href="/invoices" style={accountantLinkStyle}>
        📄 Full invoice history export (for your accountant) →
      </Link>

      <div style={subTabRowStyle}>
        {subTabs.map((t) => (
          <Link
            key={t.key}
            href={`/work?tab=invoices&sub=${t.key}`}
            style={subTabStyle(activeSub === t.key)}
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      <form action="/invoices" method="GET" style={searchFormStyle}>
        <input
          type="search"
          name="q"
          placeholder="Search by customer or invoice #"
          style={searchInputStyle}
        />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {activeList.length === 0 && (
        <p style={{ color: "#888" }}>
          {activeSub === "overdue"
            ? "Nothing overdue right now 🎉"
            : activeSub === "awaiting"
            ? "Nothing awaiting payment."
            : "No paid invoices yet."}
        </p>
      )}

      {activeSub === "paid"
        ? activeList.map((inv) => (
            <div key={inv.id} style={cardStyle("#16a34a")}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
                <div style={{ fontWeight: 600 }}>
                  {formatCurrency(inv.amount, settings.currency)}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {inv.job_type || "Job"} · paid{" "}
                {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-GB") : ""}
              </div>
            </div>
          ))
        : activeList.slice(0, 8).map((inv) => (
            <div key={inv.invoice_id} style={cardStyle("#dc2626")}>
              <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
                {formatCurrency(inv.amount, settings.currency)} · due {inv.due_date} ·{" "}
                {inv.days_overdue > 0 ? `${inv.days_overdue} days overdue` : "not yet due"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <form action="/api/invoices/chase" method="POST" style={{ flex: 1 }}>
                  <input type="hidden" name="invoiceId" value={inv.invoice_id} />
                  <button type="submit" style={secondaryButtonStyle}>
                    Chase now
                  </button>
                </form>
                <form action="/api/invoices/mark-paid" method="POST" style={{ flex: 1 }}>
                  <input type="hidden" name="invoiceId" value={inv.invoice_id} />
                  <button type="submit" style={primaryButtonStyle}>
                    Mark as paid
                  </button>
                </form>
              </div>
            </div>
          ))}

      {activeSub !== "paid" && activeList.length > 8 && (
        <Link href="/invoices" style={viewAllLinkStyle}>
          View all in {subTabs.find((t) => t.key === activeSub).label} →
        </Link>
      )}
      {activeSub === "paid" && paidInvoices.length > 8 && (
        <Link href="/invoices" style={viewAllLinkStyle}>
          View all {paidInvoices.length} paid invoices →
        </Link>
      )}
    </div>
  );
}

const tabRowStyle = { display: "flex", gap: 8, marginBottom: 16 };

const tabStyle = (active) => ({
  flex: 1,
  textAlign: "center",
  padding: "10px 0",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
  background: active ? "#111" : "white",
  color: active ? "white" : "#111",
});

const subTabRowStyle = { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" };

const subTabStyle = (active) => ({
  flex: "1 1 auto",
  textAlign: "center",
  padding: "8px 6px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: "nowrap",
  background: active ? "#2563eb" : "white",
  color: active ? "white" : "#111",
  border: active ? "none" : "1px solid #ddd",
});

const jobLinkStyle = {
  fontSize: 12,
  color: "#111",
  textDecoration: "underline",
};

const importantNoteLinkStyle = {
  ...jobLinkStyle,
  color: "#92400e",
  fontWeight: 700,
};

const searchFormStyle = { display: "flex", gap: 8, marginBottom: 16 };

const searchInputStyle = {
  flex: 1,
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
};

const searchButtonStyle = {
  background: "#111",
  color: "white",
  border: "none",
  padding: "12px 16px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
};

const cardStyle = (color) => ({
  background: "white",
  borderRadius: 10,
  padding: 14,
  marginBottom: 8,
  borderLeft: `4px solid ${color}`,
});

const primaryButtonStyle = {
  width: "100%",
  background: "#111",
  color: "white",
  border: "none",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const secondaryButtonStyle = {
  width: "100%",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
};

const declineLinkStyle = {
  background: "none",
  border: "none",
  color: "#b91c1c",
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
};

const secondaryLinkButtonStyle = {
  flex: 1,
  textAlign: "center",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};

const primaryLinkButtonStyle = {
  flex: 1,
  textAlign: "center",
  background: "#16a34a",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};

const photosLinkButtonStyle = {
  display: "block",
  textAlign: "center",
  marginTop: 8,
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};

const importantPhotosLinkButtonStyle = {
  ...photosLinkButtonStyle,
  background: "#fef3c7",
  border: "1px solid #fde68a",
  color: "#92400e",
};

const viewAllLinkStyle = {
  display: "block",
  textAlign: "center",
  fontSize: 13,
  color: "#666",
  textDecoration: "underline",
  marginTop: 8,
};

const recurringButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#fef3c7",
  color: "#92400e",
  border: "1px solid #fde68a",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  marginBottom: 16,
};

const accountantLinkStyle = {
  display: "block",
  textAlign: "center",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "12px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 13,
  textDecoration: "none",
  marginBottom: 16,
};
