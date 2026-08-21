import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";
import { syncStripeSeats } from "../../../lib/syncStripeSeats";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const memberId = form.get("memberId");

  if (!memberId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (memberId === currentMember.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { data: target } = await db
    .from("team_members")
    .select("role, is_active")
    .eq("id", memberId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "That account no longer exists" }, { status: 404 });
  }

  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner's account can't be deleted" }, { status: 400 });
  }

  if (target.is_active) {
    return NextResponse.json(
      { error: "Deactivate this person first, then delete" },
      { status: 400 }
    );
  }

  // Every cleanup step below is checked and aborts on failure BEFORE we delete
  // the team_members row. If a step half-fails we stop with the member still in
  // place (they're already deactivated), so the owner can simply retry - we
  // never end up with the account gone but its leftovers stranded. This matters
  // most for push_subscriptions, which has no foreign key, so a silent failure
  // there would otherwise orphan this person's device tokens with nothing to
  // catch it (the FK-backed tables would at least block the final delete).
  const cleanupFailed = (label, error) => {
    if (!error) return false;
    console.error(`Delete team member cleanup failed (${label}):`, error);
    return true;
  };
  const abort = () =>
    NextResponse.json(
      { error: "Couldn't fully remove that account. Nothing was deleted - please try again." },
      { status: 500 }
    );

  const { data: ownReminders, error: ownRemErr } = await db
    .from("personal_events")
    .select("id")
    .eq("created_by", memberId);
  if (cleanupFailed("read personal_events", ownRemErr)) return abort();
  const ownReminderIds = (ownReminders || []).map((r) => r.id);
  if (ownReminderIds.length > 0) {
    const { error } = await db.from("reminder_shares").delete().in("reminder_id", ownReminderIds);
    if (cleanupFailed("reminder_shares by reminder", error)) return abort();
  }

  const steps = [
    () => db.from("personal_events").delete().eq("created_by", memberId),
    () => db.from("reminder_shares").delete().eq("team_member_id", memberId),
    () => db.from("job_shares").delete().eq("team_member_id", memberId),
    () => db.from("recurring_job_shares").delete().eq("team_member_id", memberId),
    // push_subscriptions has no foreign key to team_members, so unlike the
    // rows above it is NOT cleaned up by any cascade or blocked delete - it
    // would be left orphaned, holding this person's device tokens after their
    // account is gone. Remove them explicitly, and stop if it fails.
    () => db.from("push_subscriptions").delete().eq("team_member_id", memberId),
    () => db.from("job_notes").update({ created_by: null }).eq("created_by", memberId),
    () => db.from("jobs").update({ created_by: null }).eq("created_by", memberId),
    () => db.from("jobs").update({ assigned_to: null }).eq("assigned_to", memberId),
    () => db.from("recurring_jobs").update({ created_by: null }).eq("created_by", memberId),
    () => db.from("recurring_jobs").update({ assigned_to: null }).eq("assigned_to", memberId),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (cleanupFailed("cleanup step", error)) return abort();
  }

  const { error } = await db.from("team_members").delete().eq("id", memberId);

  if (error) {
    console.error("Delete team member error:", error);
    return NextResponse.json({ error: "Couldn't delete that account" }, { status: 500 });
  }

  // Seat count changed - keep the Stripe bill honest (never blocks).
  await syncStripeSeats(currentMember.business_id);

  return NextResponse.json({ ok: true });
}
