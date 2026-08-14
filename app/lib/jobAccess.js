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
