import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const customerName = (form.get("customerName") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const jobType = (form.get("jobType") || "").toString().trim();
  const amountInput = (form.get("amount") || "").toString().trim();
  const startDate = form.get("startDate");
  const startTime = form.get("startTime");
  const durationValue = parseFloat(form.get("durationValue") || "2");
  const durationUnit = form.get("durationUnit") || "hours";
  const force = form.get("force") === "1";

  if (!customerName || !startDate || !startTime) {
    return NextResponse.json(
      { error: "Missing customer name or scheduling details" },
      { status: 400 }
    );
  }

  const durationHours = durationUnit === "days" ? durationValue * 24 : durationValue;
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  const db = supabaseAdmin();

  if (!force) {
    const { data: others } = await db
      .from("jobs")
      .select("id, job_type, customer_id, scheduled_start, scheduled_end")
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null);

    const conflict = (others || []).find((o) => {
      const oStart = new Date(o.scheduled_start);
      const oEnd = new Date(o.scheduled_end);
      return start < oEnd && end > oStart;
    });

    if (conflict) {
      const { data: conflictCustomer } = await db
        .from("customers")
        .select("name")
        .eq("id", conflict.customer_id)
        .single();

      const redirectUrl = new URL("/calendar/quick-book", req.url);
      redirectUrl.searchParams.set("customerName", customerName);
      redirectUrl.searchParams.set("jobType", jobType);
      redirectUrl.searchParams.set("amount", amountInput);
      redirectUrl.searchParams.set("startDate", startDate);
      redirectUrl.searchParams.set("startTime", startTime);
      redirectUrl.searchParams.set("durationValue", String(durationValue));
      redirectUrl.searchParams.set("durationUnit", durationUnit);
      redirectUrl.searchParams.set(
        "conflict",
        `This overlaps with ${conflictCustomer?.name || "another job"} (${
          conflict.job_type || "job"
        }) already booked at that time.`
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Reuse an existing customer with a matching name if one exists, rather
  // than creating a duplicate every time the same regular customer is booked
  const { data: existingCustomer } = await db
    .from("customers")
    .select("*")
    .ilike("name", customerName)
    .limit(1)
    .maybeSingle();

  let customerId;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    // Fill in any missing contact details, without overwriting what's there
    const updates = {};
    if (!existingCustomer.phone && phone) updates.phone = phone;
    if (!existingCustomer.email && email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      await db.from("customers").update(updates).eq("id", customerId);
    }
  } else {
    const { data: newCustomer, error: custErr } = await db
      .from("customers")
      .insert({ name: customerName, phone: phone || null, email: email || null })
      .select()
      .single();

    if (custErr) {
      console.error("Quick-book customer insert error:", custErr);
      return NextResponse.json({ error: custErr.message }, { status: 400 });
    }
    customerId = newCustomer.id;
  }

  const { error: jobErr } = await db.from("jobs").insert({
    customer_id: customerId,
    job_type: jobType || null,
    amount: amountInput ? parseFloat(amountInput) : 0,
    status: "in_progress",
    accepted_at: new Date().toISOString(),
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
  });

  if (jobErr) {
    console.error("Quick-book job insert error:", jobErr);
    return NextResponse.json({ error: jobErr.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
