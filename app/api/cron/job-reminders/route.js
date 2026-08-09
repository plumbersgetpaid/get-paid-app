import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Designed to be called once a day, first thing in the morning, by a
// scheduler. Emails the business a summary of jobs booked in for tomorrow.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const { data: jobs } = await db
    .from("jobs")
    .select("*")
    .eq("status", "in_progress")
    .gte("scheduled_start", tomorrowStart.toISOString())
    .lte("scheduled_start", tomorrowEnd.toISOString())
    .is("reminder_sent_at", null);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const customerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const { data: customers } = await db
    .from("customers")
    .select("id, name")
    .in("id", customerIds);
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));

  const settings = await getBusinessSettings();

  if (settings.contact_email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const lines = [...jobs]
      .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
      .map((j) => {
        const time = new Date(j.scheduled_start).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `${time} - ${nameById[j.customer_id] || "Customer"} (${
          j.job_type || "Job"
        })`;
      });

    try {
      await resend.emails.send({
        from: `${settings.business_name} <onboarding@resend.dev>`,
        to: settings.contact_email,
        subject: `Tomorrow's jobs (${jobs.length})`,
        html: `<div style="font-family:sans-serif; white-space:pre-wrap;"><p>Here's what's booked in for tomorrow:</p><p>${lines.join(
          "<br/>"
        )}</p></div>`,
      });
    } catch (e) {
      console.error("Reminder email error:", e);
    }
  }

  const jobIds = jobs.map((j) => j.id);
  await db
    .from("jobs")
    .update({ reminder_sent_at: new Date().toISOString() })
    .in("id", jobIds);

  return NextResponse.json({ ok: true, sent: jobs.length });
}
