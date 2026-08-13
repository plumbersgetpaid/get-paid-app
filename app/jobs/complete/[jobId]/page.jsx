import { supabaseAdmin } from "../../../lib/supabaseClient";
import CompleteJobForm from "./CompleteJobForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";

export const dynamic = "force-dynamic";

export default async function CompleteJob({ params, searchParams }) {
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

  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);
  if (!showEverything && job.assigned_to !== currentMember?.id) {
    console.error("Complete-job access check failed:", {
      jobId,
      jobAssignedTo: job.assigned_to,
      currentMemberId: currentMember?.id,
      currentMemberEmail: currentMember?.email,
      currentMemberRole: currentMember?.role,
      currentMemberIsNull: currentMember === null,
    });
    notFound();
  }

  const { data: customer } = await db
    .from("customers")
    .select("name, email")
    .eq("id", job.customer_id)
    .single();

  const { data: importantNotes } = await db
    .from("job_notes")
    .select("*")
    .eq("job_id", jobId)
    .eq("important", true)
    .order("created_at", { ascending: false });

  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  const defaultDueDateStr = defaultDueDate.toISOString().slice(0, 10);

  const amountValue = searchParams?.amount || job.amount;
  const dueDateValue = searchParams?.dueDate || defaultDueDateStr;
  const noteValue = searchParams?.note || "";
  const aiError = searchParams?.aiError === "1";

  return (
    <CompleteJobForm
      job={job}
      customer={customer}
      importantNotes={importantNotes || []}
      amountValue={amountValue}
      dueDateValue={dueDateValue}
      noteValue={noteValue}
      aiError={aiError}
      from={searchParams?.from || ""}
      showEverything={showEverything}
    />
  );
}
