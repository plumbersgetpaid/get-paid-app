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

  const { data: ownReminders } = await db
    .from("personal_events")
    .select("id")
    .eq("created_by", memberId);
  const ownReminderIds = (ownReminders || []).map((r) => r.id);
  if (ownReminderIds.length > 0) {
    await db.from("reminder_shares").delete().in("reminder_id", ownReminderIds);
  }
  await db.from("personal_events").delete().eq("created_by", memberId);

  await db.from("reminder_shares").delete().eq("team_member_id", memberId);
  await db.from("job_shares").delete().eq("team_member_id", memberId);
  await db.from("recurring_job_shares").delete().eq("team_member_id", memberId);

  // push_subscriptions has no foreign key to team_members, so unlike the
  // rows above it is NOT cleaned up by any cascade or blocked delete - it
  // would be left orphaned, holding this person's device tokens after their
  // account is gone. Remove them explicitly.
  await db.from("push_subscriptions").delete().eq("team_member_id", memberId);

  await db.from("job_notes").update({ created_by: null }).eq("created_by", memberId);
  await db.from("jobs").update({ created_by: null }).eq("created_by", memberId);
  await db.from("jobs").update({ assigned_to: null }).eq("assigned_to", memberId);
  await db.from("recurring_jobs").update({ created_by: null }).eq("created_by", memberId);
  await db.from("recurring_jobs").update({ assigned_to: null }).eq("assigned_to", memberId);

  const { error } = await db.from("team_members").delete().eq("id", memberId);

  if (error) {
    console.error("Delete team member error:", error);
    return NextResponse.json({ error: "Couldn't delete that account" }, { status: 500 });
  }

  // Seat count changed - keep the Stripe bill honest (never blocks).
  await syncStripeSeats(currentMember.business_id);

  return NextResponse.json({ ok: true });
}
