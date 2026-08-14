import { supabaseAdmin } from "../../../lib/supabaseClient";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canAccessJob } from "../../../lib/jobAccess";
import BackButton from "../../../components/BackButton";
import NotesSection from "./NotesSection";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function JobNotes({ params }) {
  const { jobId } = params;
  const db = supabaseAdmin();

  const { data: job, error } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    notFound();
  }

  // Uses the same shared access check as Work → Jobs and the job details
  // view - owner/manager, the direct assignee, or anyone it's been
  // shared with. Was only checking assigned_to directly until now, which
  // meant someone a job was shared with (rather than directly assigned)
  // could see the Job notes button but got blocked the moment they tapped it.
  const currentMember = await getCurrentTeamMember();
  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
    notFound();
  }

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .eq("id", job.customer_id)
    .single();

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" forceFresh />
        <h1 style={{ fontSize: 20, margin: 0 }}>Job notes</h1>
      </div>

      <section style={summaryCardStyle}>
        <div style={{ fontWeight: 600 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>{job.job_type || "Job"}</div>
      </section>

      <div style={internalBannerStyle}>
        🔒 Internal only - these notes are never shown or sent to the client.
      </div>

      <NotesSection jobId={job.id} />
    </main>
  );
}

const summaryCardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const internalBannerStyle = {
  background: "#f3f4f6",
  color: "#444",
  padding: 10,
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
};
