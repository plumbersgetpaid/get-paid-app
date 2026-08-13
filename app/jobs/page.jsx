import { supabaseAdmin } from "../lib/supabaseClient";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { formatCurrency } from "../lib/formatCurrency";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything } from "../lib/permissions";
import Link from "next/link";
import BackButton from "../components/BackButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const STATUS_COLORS = {
  quote_sent: "#f59e0b",
  declined: "#9ca3af",
  in_progress: "#2563eb",
  complete: "#2563eb",
  invoiced: "#dc2626",
  paid: "#16a34a",
};

export default async function AllJobs({ searchParams }) {
  const db = supabaseAdmin();
  const settings = await getBusinessSettings();
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);
  const q = (searchParams?.q || "").trim().toLowerCase();
  const status = searchParams?.status;

  let jobsQuery = db
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!showEverything) {
    jobsQuery = jobsQuery.eq("assigned_to", currentMember?.id || "__none__");
  }
  const { data: rawJobs } = await jobsQuery;

  let jobs = rawJobs || [];

  const customerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));

  const jobIds = jobs.map((j) => j.id);
  const { data: invoices } = jobIds.length
    ? await db.from("invoices").select("id, job_id").in("job_id", jobIds)
    : { data: [] };
  const invoiceIdByJobId = Object.fromEntries(
    (invoices || []).map((inv) => [inv.job_id, inv.id])
  );

  jobs = jobs.map((j) => ({
    ...j,
    customer_name: nameById[j.customer_id] || "Unknown customer",
    invoice_id: invoiceIdByJobId[j.id],
  }));

  if (status === "unscheduled") {
    jobs = jobs.filter((j) => j.status === "in_progress" && !j.scheduled_start);
  } else if (status === "late") {
    const now = new Date();
    jobs = jobs.filter(
      (j) =>
        j.status === "in_progress" &&
        j.time_confirmed !== false &&
        j.scheduled_end &&
        new Date(j.scheduled_end) < now
    );
  } else if (status === "needs-time") {
    jobs = jobs.filter((j) => j.status === "in_progress" && j.time_confirmed === false);
  } else if (status === "done") {
    jobs = jobs.filter((j) => ["complete", "invoiced", "paid"].includes(j.status));
  } else if (status) {
    jobs = jobs.filter((j) => j.status === status);
  }

  if (q) {
    jobs = jobs.filter((j) =>
      [j.customer_name, j.job_type, j.location].some((field) =>
        (field || "").toLowerCase().includes(q)
      )
    );
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work" />
        <h1 style={{ fontSize: 20, margin: 0 }}>
          {status === "unscheduled"
            ? "Jobs needing booked in"
            : status === "late"
            ? "Jobs running late"
            : status === "needs-time"
            ? "Jobs needing a time set"
            : status === "done"
            ? "Completed jobs"
            : status
            ? `Jobs · ${status.replace("_", " ")}`
            : "All jobs"}
        </h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        Every quote and job you've ever created, whatever stage it's at.
      </p>

      <form action="/jobs" method="GET" style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          placeholder="Search by customer, job type, or address"
          defaultValue={searchParams?.q || ""}
          style={searchInputStyle}
        />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {status && (
        <Link href="/jobs" style={{ fontSize: 12, color: "#666", textDecoration: "underline" }}>
          Clear filter, show all jobs
        </Link>
      )}

      {jobs.length === 0 && <p style={{ color: "#888", marginTop: 12 }}>No jobs found.</p>}

      {jobs.map((job) => (
        <div key={job.id} style={cardStyle(STATUS_COLORS[job.status] || "#ccc")}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600 }}>{job.customer_name}</div>
            {showEverything && (
              <div style={{ fontWeight: 600 }}>{formatCurrency(job.amount, settings.currency)}</div>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {job.job_type || "Job"} ·{" "}
            <span style={{ textTransform: "capitalize" }}>
              {job.status.replace("_", " ")}
            </span>{" "}
            · {new Date(job.created_at).toLocaleDateString("en-GB")}
          </div>
          {job.location && (
            <div style={{ fontSize: 12, color: "#888" }}>📍 {job.location}</div>
          )}
          {job.status === "in_progress" && job.time_confirmed === false && (
            <div style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>
              ⏰{" "}
              {job.scheduled_start
                ? new Date(job.scheduled_start).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : ""}{" "}
              · time to be confirmed
            </div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            {job.status === "in_progress" && (
              <a href={`/jobs/schedule/${job.id}`} style={jobLinkStyle}>
                Book / reschedule →
              </a>
            )}
            {job.invoice_id && showEverything && (
              <Link href={`/invoices/${job.invoice_id}`} style={jobLinkStyle}>
                View invoice →
              </Link>
            )}
            <a href={`/jobs/notes/${job.id}`} style={jobLinkStyle}>
              📝 Notes →
            </a>
          </div>
        </div>
      ))}
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

const jobLinkStyle = {
  fontSize: 12,
  color: "#111",
  textDecoration: "underline",
};
