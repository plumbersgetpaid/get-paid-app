import { supabaseAdmin } from "../lib/supabaseClient";
import { getScopedDb } from "../lib/scopedSupabaseClient";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getTodayInLondon } from "../lib/today";
import { poppins, mono, metallicTitleStyle, silverAccentStyle, c } from "../lib/theme";
import Icon from "../components/Icon";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything, canInvoice, canCreateRecurringJob } from "../lib/permissions";
import { filterJobsForMember } from "../lib/jobAccess";
import AssignAndShareControl from "../components/AssignAndShareControl";
import ReloadOnBack from "../components/ReloadOnBack";
import ConfirmSubmitButton from "../components/ConfirmSubmitButton";
import Link from "next/link";
import { nowInLondonFrame } from "../lib/today";
import RequestIdField from "../components/RequestIdField";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Work(props) {
  const searchParams = await props.searchParams;
  // Fetched ahead of the client now - the scoped client needs to know
  // who's logged in (and their business) before it can even be
  // constructed, so this can no longer come after db the way it
  // originally did. Reordering these two lines changes nothing else
  // about how this page behaves.
  const currentMember = await getCurrentTeamMember();
  const db = await getScopedDb(currentMember);
  // outstanding_invoices is a database view, not a direct table - kept
  // on the service-role client until its own RLS behaviour through the
  // view has been specifically verified, same reasoning as everywhere
  // else this view is used (Today, Calendar, the daily chase cron)
  const adminDb = supabaseAdmin();
  const settings = await getBusinessSettings();
  const showEverything = canSeeEverything(currentMember);
  // Subcontractors can't see Quotes, so defaulting to it for them would
  // land on a blank screen - default to Jobs instead, the one tab
  // they're guaranteed to have something in
  const tab = searchParams?.tab || (showEverything ? "quotes" : "jobs");

  return (
    <main>
      <ReloadOnBack />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 6, height: 26, borderRadius: 2, flexShrink: 0, ...silverAccentStyle }} />
        <h1 className={poppins.className} style={{ ...metallicTitleStyle, fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          Work
        </h1>
      </div>

      <div style={tabRowStyle}>
        {showEverything && (
          <Link href="/work?tab=quotes" style={tabStyle(tab === "quotes")}>
            Quotes
          </Link>
        )}
        <Link href="/work?tab=jobs" style={tabStyle(tab === "jobs")}>
          Jobs
        </Link>
        {canInvoice(currentMember) && (
          <Link href="/work?tab=invoices" style={tabStyle(tab === "invoices")}>
            Invoices
          </Link>
        )}
        <Link href="/work?tab=reminders" style={tabStyle(tab === "reminders")}>
          Reminders
        </Link>
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
      {tab === "invoices" && canInvoice(currentMember) && (
        <InvoicesTab
          db={db}
          adminDb={adminDb}
          settings={settings}
          sub={searchParams?.sub || "overdue"}
          businessId={currentMember.business_id}
        />
      )}
      {tab === "reminders" && (
        <RemindersTab
          db={db}
          currentMember={currentMember}
          sub={searchParams?.sub || "upcoming"}
        />
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

  // Only owner/manager ever see this tab at all, so no visibility check
  // needed here - just look up names for whoever created each quote
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
            <div style={{ fontWeight: 500, fontSize: 15 }}>{q.customer_name}</div>
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
                  <RequestIdField />
                <input type="hidden" name="jobId" value={q.id} />
                <button type="submit" style={secondaryButtonStyle}>
                  Chase quote
                </button>
              </form>
            </div>
            <form action="/api/jobs/decline-quote" method="POST" style={{ marginTop: 6 }}>
              <input type="hidden" name="jobId" value={q.id} />
              <ConfirmSubmitButton
                style={declineLinkStyle}
                confirmText={`Mark this quote for ${q.customer_name} as lost? It'll move out of your quotes list and the customer won't be chased again.`}
                confirmLabel="Yes, mark as lost"
                cancelLabel="Keep it"
              >
                Decline / lost job
              </ConfirmSubmitButton>
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

// Formats how overdue a job is in plain language, e.g. "2 hours late" or
// "3 days late" - a bare "Running late" didn't give any sense of scale
function formatLateness(scheduledEnd) {
  const diffMs = nowInLondonFrame() - new Date(scheduledEnd);
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
  // A subcontractor sees jobs they're directly assigned to, plus any
  // job someone's shared with them - this filter runs on the server, in
  // the query itself, not as a UI hide
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

  // Fetched for everyone, not just owner/manager - a subcontractor still
  // benefits from seeing who booked a job even though only owner/manager
  // get the reassignment dropdown further down
  const { data: teamMembersData } = await db
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const teamMembers = teamMembersData || [];
  const teamMemberNameById = Object.fromEntries(teamMembers.map((m) => [m.id, m.name]));

  // One query for every job's shares, grouped by job - avoids a separate
  // query per card
  const jobIdsForShares = jobs.map((j) => j.id);
  const { data: allShares } = jobIdsForShares.length
    ? await db.from("job_shares").select("job_id, team_member_id").in("job_id", jobIdsForShares)
    : { data: [] };
  // Combines the legacy single assigned_to column with job_shares into
  // one list per job - from here on, assignment and sharing are the
  // same thing: everyone in this list has full access to the job, no
  // distinction between "the" assignee and "shared with" anyone else.
  // Each entry is a fresh copy of the member object, not a shared
  // reference to the same object reused across multiple jobs - matters
  // for how this data gets serialized when passed to client components.
  const assigneesByJob = {};
  for (const j of jobs) {
    const primary = teamMembers.find((m) => m.id === j.assigned_to);
    assigneesByJob[j.id] = primary ? [{ ...primary }] : [];
  }
  for (const s of allShares || []) {
    const member = teamMembers.find((m) => m.id === s.team_member_id);
    if (!member) continue;
    const list = (assigneesByJob[s.job_id] ||= []);
    if (!list.some((a) => a.id === member.id)) list.push({ ...member });
  }

  jobs = jobs.map((j) => ({
    ...j,
    customer_name: nameById[j.customer_id] || "Unknown customer",
    creator_name: teamMemberNameById[j.created_by] || null,
  }));

  const todayStr = getTodayInLondon();
  // "Today" includes anything overdue too - a job scheduled for a day that's
  // already passed and still not marked done was previously falling through
  // every bucket (not today, not upcoming, not unscheduled) and vanishing
  // from this screen entirely, even though it was still fully active
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

  // Only fetch the completed preview list when that sub-tab is actually
  // being viewed - no point loading it every time
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

      {canCreateRecurringJob(currentMember) && (
        <Link href="/jobs/recurring" style={recurringButtonStyle}>
          <Icon name="repeat" size={15} strokeWidth={1.7} />
          Recurring jobs
        </Link>
      )}

      {activeList.length === 0 && (
        <p style={{ color: "#888" }}>Nothing in {subTabs.find((t) => t.key === activeSub).label.toLowerCase()}.</p>
      )}

      {activeList.map((job) => {
        if (activeSub === "completed") {
          return (
            <div key={job.id} style={cardStyle("#16a34a")}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{job.customer_name}</div>
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
                  href={`/jobs/view/${job.id}`}
                  style={hasImportantNoteByJob[job.id] ? importantNoteLinkStyle : jobLinkStyle}
                >
                  {hasImportantNoteByJob[job.id] ? "! " : ""}View job
                  {noteCountByJob[job.id] ? ` · ${noteCountByJob[job.id]} note${noteCountByJob[job.id] === 1 ? "" : "s"}` : ""}
                </a>
              </div>
            </div>
          );
        }

        const isLate =
          job.time_confirmed !== false &&
          job.scheduled_end &&
          new Date(job.scheduled_end) < nowInLondonFrame() &&
          !job.status.startsWith("complete");

        return (
          <div key={job.id} style={cardStyle(isLate ? "#dc2626" : "#2563eb")}>
            <div style={{ fontWeight: 500, fontSize: 15 }}>{job.customer_name}</div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {job.job_type}
              {showEverything && <> · {formatCurrency(job.amount, settings.currency)}</>}
              {job.creator_name && <> · booked by {job.creator_name}</>}
            </div>
            {isLate ? (
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 500, marginTop: 3 }}>
                Running {formatLateness(job.scheduled_end)}
              </div>
            ) : job.time_confirmed === false ? (
              <div style={{ fontSize: 12, color: "#b45309", fontWeight: 500, marginTop: 3 }}>
                {new Date(job.scheduled_start).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                · time to be confirmed
              </div>
            ) : (
              job.scheduled_start && (
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>
                  Due{" "}
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
            {canInvoice(currentMember) && job.deposit_amount && !job.deposit_received_on ? (
              <div style={{ fontSize: 12, color: "#b45309", fontWeight: 500, marginTop: 3 }}>
                Awaiting {formatCurrency(job.deposit_amount, settings.currency)} deposit
              </div>
            ) : null}
            <a
              href={`/jobs/view/${job.id}`}
              style={hasImportantNoteByJob[job.id] ? importantViewJobButtonStyle : viewJobButtonStyle}
            >
              {hasImportantNoteByJob[job.id] ? "! " : ""}View job
              {noteCountByJob[job.id] ? ` · ${noteCountByJob[job.id]} note${noteCountByJob[job.id] === 1 ? "" : "s"}` : ""}
            </a>
            {showEverything && (
              <AssignAndShareControl
                jobId={job.id}
                initialAssignees={assigneesByJob[job.id] || []}
                teamMembers={teamMembers}
              />
            )}
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

async function InvoicesTab({ db, adminDb, settings, sub, businessId }) {
  const activeSub = ["overdue", "awaiting", "paid"].includes(sub) ? sub : "overdue";

  const { data: outstanding } = await adminDb
    .from("outstanding_invoices")
    .select("*")
    .eq("business_id", businessId)
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

  // Only fetch customer/job details for paid invoices when that sub-tab is
  // actually being viewed - no point loading it every time
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
        Full invoice history export (for your accountant) →
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
            ? "Nothing overdue right now"
            : activeSub === "awaiting"
            ? "Nothing awaiting payment."
            : "No paid invoices yet."}
        </p>
      )}

      {activeSub === "paid"
        ? activeList.map((inv) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`} style={paidInvoiceCardLinkStyle}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{inv.customer_name}</div>
                <div style={{ fontWeight: 500, fontSize: 15 }}>
                  {formatCurrency(Math.max(0, Number(inv.amount) - (Number(inv.deposit_amount) || 0)), settings.currency)}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {inv.job_type || "Job"} · paid{" "}
                {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-GB") : ""}
              </div>
            </Link>
          ))
        : activeList.slice(0, 8).map((inv) => (
            <div key={inv.invoice_id} style={cardStyle("#dc2626")}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{inv.customer_name}</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>
                {formatCurrency(Math.max(0, Number(inv.amount) - (Number(inv.deposit_amount) || 0)), settings.currency)} · due {inv.due_date} ·{" "}
                {inv.days_overdue > 0 ? `${inv.days_overdue} days overdue` : "not yet due"}
              </div>
              <Link
                href={`/invoices/${inv.invoice_id}`}
                style={{ ...jobLinkStyle, display: "inline-block", marginBottom: 10 }}
              >
                View invoice →
              </Link>
              <div style={{ display: "flex", gap: 8 }}>
                <form action="/api/invoices/chase" method="POST" style={{ flex: 1 }}>
                  <RequestIdField />
                  <input type="hidden" name="invoiceId" value={inv.invoice_id} />
                  <button type="submit" style={secondaryButtonStyle}>
                    Chase now
                  </button>
                </form>
                <form action="/api/invoices/mark-paid" method="POST" style={{ flex: 1 }}>
                  <RequestIdField />
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

// Visible to every role, unlike Quotes/Invoices - a reminder is
// personal-or-shared, never an owner/manager-only financial concern.
// Split into just two sub-tabs (upcoming/past) deliberately, not the
// four-way split Jobs uses - reminders don't have a completion workflow
// or an "unscheduled" state the way jobs do, so more sub-tabs here would
// just be empty scaffolding, not real organisation
async function RemindersTab({ db, currentMember, sub }) {
  const activeSub = ["upcoming", "past"].includes(sub) ? sub : "upcoming";
  const meId = currentMember?.id || "__none__";

  // Same ownership rule as Calendar - a reminder shows up here if this
  // person created it, or if an owner/manager shared it with them
  const { data: sharedReminderRows } = await db
    .from("reminder_shares")
    .select("reminder_id")
    .eq("team_member_id", meId);
  const sharedReminderIds = (sharedReminderRows || []).map((r) => r.reminder_id);

  let remindersQuery = db
    .from("personal_events")
    .select("*")
    .order("scheduled_start", { ascending: true });
  remindersQuery =
    sharedReminderIds.length > 0
      ? remindersQuery.or(`created_by.eq.${meId},id.in.(${sharedReminderIds.join(",")})`)
      : remindersQuery.eq("created_by", meId);
  const { data: rawReminders } = await remindersQuery;
  const reminders = rawReminders || [];

  // For labelling shared reminders - who else is on each one, and who
  // set it if it wasn't this person - same pattern as Calendar
  const { data: allTeamMembers } = await db.from("team_members").select("id, name");
  const teamMemberNameById = Object.fromEntries((allTeamMembers || []).map((m) => [m.id, m.name]));
  const reminderIds = reminders.map((r) => r.id);
  const { data: allReminderShares } = reminderIds.length
    ? await db
        .from("reminder_shares")
        .select("reminder_id, team_member_id")
        .in("reminder_id", reminderIds)
    : { data: [] };
  const sharedNamesByReminder = {};
  for (const s of allReminderShares || []) {
    const name = teamMemberNameById[s.team_member_id];
    if (!name) continue;
    (sharedNamesByReminder[s.reminder_id] ||= []).push(name);
  }

  const now = nowInLondonFrame();
  const upcomingReminders = reminders.filter((r) => new Date(r.scheduled_start) >= now);
  const pastReminders = reminders
    .filter((r) => new Date(r.scheduled_start) < now)
    .reverse(); // most recently passed first, not the oldest ones from years ago

  const activeList = activeSub === "upcoming" ? upcomingReminders : pastReminders;

  const subTabs = [
    { key: "upcoming", label: "Upcoming", count: upcomingReminders.length },
    { key: "past", label: "Past", count: pastReminders.length },
  ];

  return (
    <div>
      <Link href="/calendar/reminder/new" style={addReminderButtonStyle}>
        + Reminder
      </Link>

      <div style={subTabRowStyle}>
        {subTabs.map((t) => (
          <Link
            key={t.key}
            href={`/work?tab=reminders&sub=${t.key}`}
            style={subTabStyle(activeSub === t.key)}
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      {activeList.length === 0 && (
        <p style={{ color: "#888" }}>
          {activeSub === "upcoming" ? "No upcoming reminders." : "No past reminders."}
        </p>
      )}

      {activeList.slice(0, 20).map((reminder) => {
        const isMine = reminder.created_by === meId;
        const sharedNames = sharedNamesByReminder[reminder.id] || [];
        let suffix = "";
        if (isMine && sharedNames.length > 0) {
          suffix = ` · also for ${sharedNames.join(", ")}`;
        } else if (!isMine) {
          suffix = ` · set by ${teamMemberNameById[reminder.created_by] || "someone"}`;
        }

        return (
          <Link
            key={reminder.id}
            href={`/calendar/reminder/${reminder.id}`}
            style={reminderCardLinkStyle}
          >
            <div style={{ fontWeight: 500, fontSize: 15 }}>{reminder.title}</div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {new Date(reminder.scheduled_start).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {suffix}
            </div>
          </Link>
        );
      })}

      {activeList.length > 20 && (
        <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
          Showing the first 20 - check Calendar for anything further out.
        </p>
      )}
    </div>
  );
}

const tabRowStyle = { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" };

const tabStyle = (active) => ({
  flex: 1,
  textAlign: "center",
  padding: "11px 0",
  borderRadius: 2,
  textDecoration: "none",
  fontWeight: 500,
  fontSize: 13.5,
  background: active ? c.ink : c.paper,
  color: active ? c.paper : c.ink,
  border: active ? `1px solid ${c.ink}` : `1px solid ${c.line}`,
});

const subTabRowStyle = { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" };

const subTabStyle = (active) => ({
  flex: "1 1 auto",
  textAlign: "center",
  padding: "9px 6px",
  borderRadius: 2,
  textDecoration: "none",
  fontWeight: 500,
  fontSize: 11.5,
  whiteSpace: "nowrap",
  background: active ? c.ink : c.paper,
  color: active ? c.paper : c.mid,
  border: `1px solid ${active ? c.ink : c.line}`,
});

const jobLinkStyle = {
  fontSize: 12,
  color: "#111",
  textDecoration: "underline",
};

const importantNoteLinkStyle = {
  ...jobLinkStyle,
  color: "#92400e",
  fontWeight: 500,
};

const searchFormStyle = { display: "flex", gap: 8, marginBottom: 16 };

const searchInputStyle = {
  flex: 1,
  padding: "12px",
  borderRadius: 2,
  border: `1px solid ${c.line}`,
  fontSize: 15,
};

const searchButtonStyle = {
  background: c.ink,
  color: c.paper,
  border: "none",
  padding: "12px 16px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13.5,
};

const cardStyle = (color) => ({
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderLeft: `3px solid ${color}`,
  borderRadius: 3,
  padding: "var(--card-pad-tight, 14px)",
  marginBottom: 8,
});

// Paid invoice cards have no other interactive elements inside them, so
// the whole card can safely be the link - unlike the unpaid cards below,
// which have Chase/Mark-as-paid buttons and need a separate link instead
// (a link can't wrap a form/button without breaking, since both are
// interactive elements)
const paidInvoiceCardLinkStyle = {
  ...cardStyle("#16a34a"),
  display: "block",
  textDecoration: "none",
  color: "inherit",
};

// Same purple used for reminder entries on Calendar, so a reminder
// reads as the same "thing" wherever it shows up in the app
const reminderCardLinkStyle = {
  ...cardStyle("#9333ea"),
  display: "block",
  textDecoration: "none",
  color: "inherit",
};

const addReminderButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: c.ink,
  color: c.paper,
  border: "none",
  borderRadius: 2,
  padding: "11px 16px",
  fontSize: 13.5,
  fontWeight: 500,
  textDecoration: "none",
  marginBottom: 16,
};

const primaryButtonStyle = {
  width: "100%",
  background: c.ink,
  color: c.paper,
  border: "none",
  padding: "10px 10px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13,
};

const secondaryButtonStyle = {
  width: "100%",
  background: c.paper,
  color: c.ink,
  border: `1px solid ${c.line}`,
  padding: "10px 10px",
  borderRadius: 2,
  fontWeight: 500,
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

// The single entry point into a job's full details (job description,
// contact info, schedule, and from there Reschedule/Mark done/Notes) -
// replaces what used to be three or four separate buttons crowding each
// card. Carries the important-note warning itself now, since Notes is
// no longer a separate button on the card to carry it.
const viewJobButtonStyle = {
  display: "block",
  textAlign: "center",
  marginTop: 10,
  background: c.paper,
  color: c.ink,
  border: `1px solid ${c.line}`,
  padding: "11px 12px",
  borderRadius: 2,
  fontWeight: 500,
  textDecoration: "none",
  fontSize: 13.5,
};

const importantViewJobButtonStyle = {
  ...viewJobButtonStyle,
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
  gap: 8,
  background: c.paper,
  color: c.ink,
  border: `1px solid ${c.line}`,
  borderRadius: 2,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
  marginBottom: 16,
};

const accountantLinkStyle = {
  display: "block",
  textAlign: "center",
  background: c.paper,
  color: c.ink,
  border: `1px solid ${c.line}`,
  padding: "12px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13,
  textDecoration: "none",
  marginBottom: 16,
};
