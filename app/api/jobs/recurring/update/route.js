import { getBusinessSettings } from "../../../../lib/getBusinessSettings";
import { toStoredAmount } from "../../../../lib/vat";
import { createRecurringOccurrence } from "../../../../lib/createRecurringOccurrence";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canCreateRecurringJob } from "../../../../lib/permissions";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";
import { redirectAfterMutation } from "../../../../lib/redirectAfterMutation";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canCreateRecurringJob(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const recurringId = form.get("recurringId");
  const jobType = (form.get("jobType") || "").toString().trim();
  const location = (form.get("location") || "").toString().trim();
  // In 'exclusive' VAT mode the edit form PREFILLS the before-VAT figure
  // (see the edit page), so converting here round-trips an untouched form
  // back to the same stored gross - no double-VAT on resubmit.
  const amountEntrySettings = await getBusinessSettings();
  const amountRaw = form.get("amount");
  const amount = amountRaw ? toStoredAmount(amountRaw, amountEntrySettings) : amountRaw;
  const preferredTime = form.get("preferredTime") || "09:00";
  const confirmTimeLater = form.get("confirmTimeLater") === "1";
  const frequencyValue = parseInt(form.get("frequencyValue") || "1", 10);
  const frequencyUnit = form.get("frequencyUnit") || "months";
  const notifyEmail = form.get("notifyEmail") === "1";
  const desiredAssigneeIds = form.getAll("assignedTo").filter(Boolean);
  const nextOccurrenceTime = (form.get("nextOccurrenceTime") || "").toString().trim();

  if (!recurringId) {
    return NextResponse.json({ error: "Missing recurringId" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { data: existingShares } = await db
    .from("recurring_job_shares")
    .select("team_member_id")
    .eq("recurring_job_id", recurringId);
  const currentShareIds = (existingShares || []).map((s) => s.team_member_id);

  const { data: updated, error } = await db
    .from("recurring_jobs")
    .update({
      job_type: jobType || null,
      location: location || null,
      amount: amount ? parseFloat(amount) : 0,
      preferred_time: preferredTime,
      confirm_time_later: confirmTimeLater,
      frequency_value: frequencyValue,
      frequency_unit: frequencyUnit,
      notify_email: notifyEmail,
      next_occurrence_time: nextOccurrenceTime || null,
      assigned_to: null,
    })
    .eq("id", recurringId)
    .select()
    .single();

  if (error) {
    console.error("Update recurring job error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const currentSet = new Set(currentShareIds);
  const desiredSet = new Set(desiredAssigneeIds);
  const toAdd = [...desiredSet].filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));

  if (toRemove.length > 0) {
    // Access revocation. If this fails silently the removed worker stays in
    // the share set and createRecurringOccurrence keeps assigning them to
    // every future occurrence — a reassigned/fired worker keeps getting new
    // jobs while the owner's screen says they were removed. Surface it, and
    // do it BEFORE generating any due occurrence below.
    const { error: removeErr } = await db
      .from("recurring_job_shares")
      .delete()
      .eq("recurring_job_id", recurringId)
      .in("team_member_id", toRemove);
    if (removeErr) {
      console.error("Recurring job unassign error:", removeErr);
      return NextResponse.json(
        { error: "Couldn't update who this recurring job is assigned to. Try again." },
        { status: 500 }
      );
    }
  }
  if (toAdd.length > 0) {
    const { error: addErr } = await db.from("recurring_job_shares").insert(
      toAdd.map((teamMemberId) => ({
        recurring_job_id: recurringId,
        team_member_id: teamMemberId,
        business_id: currentMember.business_id,
      }))
    );
    if (addErr) {
      console.error("Recurring job assign update error:", addErr);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (updated?.active && updated.next_occurrence <= todayStr) {
    const settings = await getBusinessSettings();
    await createRecurringOccurrence(db, settings, updated);
  }

  return redirectAfterMutation(req, "/jobs/recurring");
}
