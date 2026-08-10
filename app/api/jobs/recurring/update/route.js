import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
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
  const autoInvoice = form.get("autoInvoice") === "1";
  const nextOccurrenceTime = (form.get("nextOccurrenceTime") || "").toString().trim();

  if (!recurringId) {
    return NextResponse.json({ error: "Missing recurringId" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
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
      auto_invoice: autoInvoice,
      next_occurrence_time: nextOccurrenceTime || null,
    })
    .eq("id", recurringId);

  if (error) {
    console.error("Update recurring job error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/jobs/recurring", req.url));
}
