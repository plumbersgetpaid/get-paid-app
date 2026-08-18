import { findExistingCustomer } from "../../../../lib/findCustomer";
import { getBusinessSettings } from "../../../../lib/getBusinessSettings";
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
  const name = (form.get("name") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const jobType = (form.get("jobType") || "").toString().trim();
  const location = (form.get("location") || "").toString().trim();
  const amount = form.get("amount");
  const startDate = form.get("startDate");
  const preferredTime = form.get("preferredTime") || "09:00";
  const frequencyValue = parseInt(form.get("frequencyValue") || "1", 10);
  const frequencyUnit = form.get("frequencyUnit") || "months";
  const confirmTimeLater = form.get("confirmTimeLater") === "1";
  const notifyEmail = form.get("notifyEmail") === "1";
  const assignedToIds = form.getAll("assignedTo").filter(Boolean);

  if (!name || !startDate) {
    return NextResponse.json({ error: "Missing customer name or start date" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const existingCustomer = await findExistingCustomer(db, { name, email, phone });

  let customerId;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    const updates = {};
    if (!existingCustomer.phone && phone) updates.phone = phone;
    if (!existingCustomer.email && email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      await db.from("customers").update(updates).eq("id", customerId);
    }
  } else {
    const { data: newCustomer, error: custErr } = await db
      .from("customers")
      .insert({ name, phone: phone || null, email: email || null, business_id: currentMember.business_id })
      .select()
      .single();

    if (custErr) {
      console.error("Recurring job customer insert error:", custErr);
      return NextResponse.json({ error: custErr.message }, { status: 400 });
    }
    customerId = newCustomer.id;
  }

  const { data: newRecurring, error } = await db
    .from("recurring_jobs")
    .insert({
      customer_id: customerId,
      job_type: jobType || null,
      location: location || null,
      amount: amount ? parseFloat(amount) : 0,
      next_occurrence: startDate,
      preferred_time: preferredTime,
      frequency_value: frequencyValue,
      frequency_unit: frequencyUnit,
      confirm_time_later: confirmTimeLater,
      notify_email: notifyEmail,
      created_by: currentMember?.id || null,
      assigned_to: null,
      business_id: currentMember.business_id,
    })
    .select()
    .single();

  if (error) {
    console.error("Recurring job insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (assignedToIds.length > 0 && newRecurring) {
    const { error: sharesErr } = await db.from("recurring_job_shares").insert(
      assignedToIds.map((teamMemberId) => ({
        recurring_job_id: newRecurring.id,
        team_member_id: teamMemberId,
        business_id: currentMember.business_id,
      }))
    );
    if (sharesErr) {
      console.error("Recurring job assign error:", sharesErr);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (startDate <= todayStr) {
    const settings = await getBusinessSettings();
    await createRecurringOccurrence(db, settings, newRecurring);
  }

  return redirectAfterMutation(req, "/jobs/recurring");
}
