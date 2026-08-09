import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { sendWhatsAppMessage } from "../../../lib/sendWhatsApp";
import { computeScheduleEnd } from "../../../lib/duration";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const customerName = (form.get("customerName") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const jobType = (form.get("jobType") || "").toString().trim();
  const location = (form.get("location") || "").toString().trim();
  const amountInput = (form.get("amount") || "").toString().trim();
  const startDate = form.get("startDate");
  const startTime = form.get("startTime");
  const durationValue = parseFloat(form.get("durationValue") || "2");
  const durationUnit = form.get("durationUnit") || "hours";
  const force = form.get("force") === "1";
  const notifyEmail = form.get("notifyEmail") === "1";
  const notifyWhatsapp = form.get("notifyWhatsapp") === "1";

  if (!customerName || !startDate || !startTime) {
    return NextResponse.json(
      { error: "Missing customer name or scheduling details" },
      { status: 400 }
    );
  }

  const settings = await getBusinessSettings();
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = computeScheduleEnd(start, durationValue, durationUnit, settings.include_weekends);

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
      redirectUrl.searchParams.set("phone", phone);
      redirectUrl.searchParams.set("email", email);
      redirectUrl.searchParams.set("jobType", jobType);
      redirectUrl.searchParams.set("location", location);
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
  let customerEmail = email || null;
  let customerPhone = phone || null;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    // Fill in any missing contact details, without overwriting what's there
    const updates = {};
    if (!existingCustomer.phone && phone) updates.phone = phone;
    if (!existingCustomer.email && email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      await db.from("customers").update(updates).eq("id", customerId);
    }
    customerEmail = existingCustomer.email || email || null;
    customerPhone = existingCustomer.phone || phone || null;
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
    location: location || null,
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

  // Let the client know, on whichever channels were requested
  if (notifyEmail || notifyWhatsapp) {
    const template = await getTemplate("booking_confirmation");
    const vars = {
      customer_name: customerName,
      job_type: jobType || "your job",
      start_date: start.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      start_time: startTime,
      duration: `${durationValue} ${durationUnit}`,
      business_name: settings.business_name,
    };
    const bodyText = renderTemplate(template.body, vars);
    const subject = renderTemplate(template.subject, vars) || "Booking confirmed";

    if (notifyEmail && customerEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${bodyText.replace(
          /\n/g,
          "<br/>"
        )}</div>`;
        await resend.emails.send({
          from: `${settings.business_name} <onboarding@resend.dev>`,
          to: customerEmail,
          subject,
          html,
        });
      } catch (e) {
        console.error("Booking confirmation email error:", e);
      }
    }

    if (notifyWhatsapp && customerPhone) {
      await sendWhatsAppMessage(customerPhone, bodyText);
    }
  }

  return NextResponse.redirect(new URL("/calendar", req.url));
}
