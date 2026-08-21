import { canSeeEverything } from "./permissions";

export async function canAccessJob(db, job, currentMember) {
  if (canSeeEverything(currentMember)) return true;
  if (!currentMember || !job) return false;
  if (job.assigned_to === currentMember.id) return true;

  const { data } = await db
    .from("job_shares")
    .select("id")
    .eq("job_id", job.id)
    .eq("team_member_id", currentMember.id)
    .maybeSingle();

  return !!data;
}

// Can this member act on THIS invoice? Invoices are job-child resources, so
// the rule is the job's rule: owner/manager = any; a subcontractor = only if
// the invoice's job is assigned to (or shared with) them. Managers short-
// circuit with no query; subs pay one job lookup. Runs on the scoped client,
// so the invoice/job are already tenant-confined - this adds the per-job layer
// that the plain can_invoice flag doesn't.
export async function canAccessInvoice(db, invoiceId, currentMember) {
  if (canSeeEverything(currentMember)) return true;
  if (!currentMember || !invoiceId) return false;
  const { data: inv } = await db
    .from("invoices")
    .select("job_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv?.job_id) return false;
  const { data: job } = await db
    .from("jobs")
    .select("id, assigned_to")
    .eq("id", inv.job_id)
    .maybeSingle();
  return canAccessJob(db, job, currentMember);
}

// All job ids a member can access: assigned to them OR shared with them.
// Used to scope the aggregate invoice lists to a subcontractor's own jobs.
export async function getAccessibleJobIds(db, currentMember) {
  if (!currentMember) return [];
  const shared = await getSharedJobIds(db, currentMember.id);
  const { data: assigned } = await db
    .from("jobs")
    .select("id")
    .eq("assigned_to", currentMember.id);
  return [...new Set([...(assigned || []).map((j) => j.id), ...shared])];
}

// Narrow caller-supplied assignee IDs down to the ones that are real, active
// members of the caller's own business. `db` is already business-scoped (RLS),
// so an ID from another business - or a since-deleted/deactivated member -
// simply isn't returned and is dropped before we write any share row. Keeps a
// tampered or stale request from planting a job_shares/recurring_job_shares row
// that points at someone who could never see it. Order/duplicates don't matter
// for share rows, so we return the validated set as-is.
export async function validAssigneeIds(db, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return [];
  const { data } = await db
    .from("team_members")
    .select("id")
    .in("id", unique)
    .eq("is_active", true);
  return (data || []).map((m) => m.id);
}

export async function getSharedJobIds(db, teamMemberId) {
  if (!teamMemberId) return [];
  const { data } = await db
    .from("job_shares")
    .select("job_id")
    .eq("team_member_id", teamMemberId);
  return (data || []).map((r) => r.job_id);
}

export async function filterJobsForMember(db, query, teamMemberId) {
  const sharedIds = await getSharedJobIds(db, teamMemberId);
  const id = teamMemberId || "__none__";
  if (sharedIds.length > 0) {
    const idList = sharedIds.join(",");
    return query.or(`assigned_to.eq.${id},id.in.(${idList})`);
  }
  return query.eq("assigned_to", id);
}
