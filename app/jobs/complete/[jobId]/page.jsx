import CompleteJobForm from "./CompleteJobForm";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything, canInvoice } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function CompleteJob({ params, searchParams }) {
  const { jobId } = params;

  const currentMember = await getCurrentTeamMember();

  const showEverything = canSeeEverything(currentMember);
  if (!canInvoice(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);

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
