import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { findExistingCustomer } from "../../../../lib/findCustomer";
import { getBusinessSettings } from "../../../../lib/getBusinessSettings";
import { createRecurringOccurrence } from "../../../../lib/createRecurringOccurrence";
import { NextResponse } from "next/server";

export async function POST(req) {
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
  const autoInvoice = form.get("autoInvoice") === "1";
  const confirmTimeLater = form.get("confirmTimeLater") === "1";
  const notifyEmail = form.get("notifyEmail") === "1";
  const notifyWhatsapp = form.get("notifyWhatsapp") === "1";

  if (!name || !startDate) {
    return NextResponse.json({ error: "Missing customer name or start date" }, { status: 400 });
  }

  const db = supabaseAdmin();

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
      .insert({ name, phone: phone || null, email: email || null })
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
      auto_invoice: autoInvoice,
      confirm_time_later: confirmTimeLater,
      notify_email: notifyEmail,
      notify_whatsapp: notifyWhatsapp,
    })
    .select()
    .single();

  if (error) {
    console.error("Recurring job insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If the first occurrence is today or already in the past, don't make
  // them wait for tomorrow's daily check - create it right now
  const todayStr = new Date().toISOString().slice(0, 10);
  if (startDate <= todayStr) {
    const settings = await getBusinessSettings();
    await createRecurringOccurrence(db, settings, newRecurring);
  }

  return NextResponse.redirect(new URL("/jobs/recurring", req.url));
}
