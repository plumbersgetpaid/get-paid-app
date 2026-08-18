import CompleteJobForm from "./CompleteJobForm";
import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything, canInvoice } from "../../../lib/permissions";
import { canAccessJob } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function CompleteJob(props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { jobId } = params;

  // Fetched ahead of the job itself now - the scoped client needs to
  // know who's logged in (and their business) before it can even be
  // constructed, so this can no longer come after the job lookup the
  // way it originally did.
  const currentMember = await getCurrentTeamMember();

  // Marking a job done (and invoicing) is gated by the specific
  // can_invoice permission now, not blanket owner/manager status - an
  // individual subcontractor can be granted this. Kept separate from
  // showEverything below, which still governs price visibility within
  // the form itself - being allowed to invoice doesn't also mean seeing
  // every price, since that's not one of the six granular permissions.
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

  // can_invoice alone only means this person is trusted to invoice in
  // general - it was never actually checking whether they're assigned
  // to or shared on this specific job, meaning a subcontractor could
  // complete any job in the business regardless of assignment. Same
  // shared check used everywhere else a job's own access needs
  // confirming: owner/manager, the direct assignee, or anyone it's
  // been shared with.
  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
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

  // Default due date: 14 days from today, in yyyy-mm-dd for the date input
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  const defaultDueDateStr = defaultDueDate.toISOString().slice(0, 10);

  // If we're returning from an "Enhance with AI" round trip, keep whatever
  // the tradie had entered instead of resetting back to the defaults
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
