import { supabaseAdmin } from "../../../lib/supabaseClient";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
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

  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);
  if (!showEverything && job.assigned_to !== currentMember?.id) {
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
