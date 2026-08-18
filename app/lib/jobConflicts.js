// Two jobs overlapping in time are only a clash if the same person is
// expected at both.
//
// Before this existed, any overlap counted: a two-person business booking
// two jobs at 9am was warned it had double-booked, which it hadn't. A
// warning that fires when nothing is wrong is worse than no warning,
// because it teaches people to click past the one that matters.
//
// Unassigned counts as "whoever runs the business", so two unassigned
// jobs at the same time are a genuine clash. An unassigned job against
// one assigned to a team member is not.
export async function narrowToRealClashes(db, overlapping, ownAssigneeIds) {
  if (overlapping.length === 0) return [];

  const { data: shares } = await db
    .from("job_shares")
    .select("job_id, team_member_id")
    .in(
      "job_id",
      overlapping.map((o) => o.id)
    );

  const assigneesByJob = new Map();
  for (const share of shares || []) {
    if (!assigneesByJob.has(share.job_id)) assigneesByJob.set(share.job_id, new Set());
    assigneesByJob.get(share.job_id).add(share.team_member_id);
  }

  const own = new Set(ownAssigneeIds || []);
  return overlapping.filter((o) => {
    const theirs = assigneesByJob.get(o.id) || new Set();
    if (own.size === 0 && theirs.size === 0) return true;
    return [...own].some((id) => theirs.has(id));
  });
}

// Everyone expected at an existing job: the direct assignment plus anyone
// it's been shared with.
export async function assigneesForJob(db, jobId, directAssignee) {
  const ids = new Set();
  if (directAssignee) ids.add(directAssignee);
  const { data: shares } = await db
    .from("job_shares")
    .select("team_member_id")
    .eq("job_id", jobId);
  for (const s of shares || []) ids.add(s.team_member_id);
  return ids;
}
