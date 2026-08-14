import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../../lib/getBusinessSettings";
import { createRecurringOccurrence } from "../../../../lib/createRecurringOccurrence";
import { getCurrentTeamMember } from "../../../../lib/auth";
import { canSeeEverything } from "../../../../lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const recurringId = form.get("recurringId");
  const jobType = (form.get("jobType") || "").toString().trim();
  const location = (form.get("location") || "").toString().trim();
  const amount = form.get("amount");
  const preferredTime = form.get("preferredTime") || "09:00";
  const confirmTimeLater = form.get("confirmTimeLater") === "1";
  const frequencyValue = parseInt(form.get("frequencyValue") || "1", 10);
  const frequencyUnit = form.get("frequencyUnit") || "months";
  const notifyEmail = form.get("notifyEmail") === "1";
  const notifyWhatsapp = form.get("notifyWhatsapp") === "1";
  const assignedTo = (form.get("assignedTo") || "").toString().trim() || null;
  const nextOccurrenceTime = (form.get("nextOccurrenceTime") || "").toString().trim();

  if (!recurringId) {
    return NextResponse.json({ error: "Missing recurringId" }, { status: 400 });
  }

  const db = supabaseAdmin();
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
      notify_whatsapp: notifyWhatsapp,
      next_occurrence_time: nextOccurrenceTime || null,
      assigned_to: assignedTo,
    })
    .eq("id", recurringId)
    .select()
    .single();

  if (error) {
    console.error("Update recurring job error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (updated?.active && updated.next_occurrence <= todayStr) {
    const settings = await getBusinessSettings();
    await createRecurringOccurrence(db, settings, updated);
  }

  return NextResponse.redirect(new URL("/jobs/recurring", req.url));
}
