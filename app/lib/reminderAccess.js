export async function canAccessReminder(db, reminder, currentMemberId) {
  if (!reminder || !currentMemberId) return false;
  if (reminder.created_by === currentMemberId) return true;

  const { data } = await db
    .from("reminder_shares")
    .select("id")
    .eq("reminder_id", reminder.id)
    .eq("team_member_id", currentMemberId)
    .maybeSingle();

  return !!data;
}
