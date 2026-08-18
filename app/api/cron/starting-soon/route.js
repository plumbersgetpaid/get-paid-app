import { cronAuthorized } from "../../../lib/requireCron";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { sendPushToMember } from "../../../lib/push";
import { nowInLondonFrame } from "../../../lib/today";
import { NextResponse } from "next/server";

// Pushes a "starts soon" nudge roughly an hour before a job or personal
// reminder begins. Runs every 15 minutes (Vercel Pro), catching each item
// once, ~50-65 min ahead, and marking it so it isn't sent again. A job
// reschedule clears reminder_sent_at, so a moved job re-nudges for its new
// time.
//
// Times are compared in the London frame, because scheduled_start is stored
// as London wall-clock (see lib/today.js).
const LEAD_MINUTES = 65;

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC", // stored value is already London-wall-clock in a UTC frame
  });
}

export async function GET(req) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  const db = supabaseAdmin();
  const now = nowInLondonFrame();
  const nowIso = now.toISOString();
  const windowEnd = new Date(now.getTime() + LEAD_MINUTES * 60000).toISOString();

  let pushed = 0;

  // ---- jobs starting soon ----
  const { data: jobs } = await db
    .from("jobs")
    .select("id, business_id, customer_id, job_type, scheduled_start, assigned_to")
    .eq("status", "in_progress")
    .not("time_confirmed", "is", false)
    .is("reminder_sent_at", null)
    .gt("scheduled_start", nowIso)
    .lte("scheduled_start", windowEnd);

  for (const job of jobs || []) {
    const { data: customer } = await db
      .from("customers")
      .select("name")
      .eq("id", job.customer_id)
      .maybeSingle();

    // Who to nudge: whoever the job is assigned to or shared with; if
    // nobody, the owner/manager who'd be doing it themselves.
    const recipients = new Set();
    if (job.assigned_to) recipients.add(job.assigned_to);
    const { data: shares } = await db
      .from("job_shares")
      .select("team_member_id")
      .eq("job_id", job.id);
    for (const s of shares || []) recipients.add(s.team_member_id);
    if (recipients.size === 0) {
      const { data: owners } = await db
        .from("team_members")
        .select("id")
        .eq("business_id", job.business_id)
        .in("role", ["owner", "manager"])
        .eq("is_active", true);
      for (const o of owners || []) recipients.add(o.id);
    }

    const payload = {
      title: `Job at ${fmtTime(job.scheduled_start)}`,
      body: `${customer?.name || "Customer"} — ${job.job_type || "Job"}. Starts within the hour.`,
      url: `/jobs/view/${job.id}`,
    };
    for (const memberId of recipients) {
      const r = await sendPushToMember(memberId, payload);
      pushed += r.sent;
    }
    await db.from("jobs").update({ reminder_sent_at: new Date().toISOString() }).eq("id", job.id);
  }

  // ---- personal reminders starting soon ----
  const { data: events, error: eventsErr } = await db
    .from("personal_events")
    .select("id, title, scheduled_start, created_by")
    .is("reminder_sent_at", null)
    .gt("scheduled_start", nowIso)
    .lte("scheduled_start", windowEnd);
  if (eventsErr) {
    // Don't let a reminders-query problem (e.g. the column not migrated yet)
    // sink the jobs nudges that already ran.
    console.error("starting-soon: personal_events query failed:", eventsErr.message);
  }

  for (const ev of events || []) {
    if (ev.created_by) {
      const r = await sendPushToMember(ev.created_by, {
        title: `Reminder at ${fmtTime(ev.scheduled_start)}`,
        body: ev.title || "You have a reminder coming up.",
        url: "/calendar",
      });
      pushed += r.sent;
    }
    await db
      .from("personal_events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", ev.id);
  }

  return NextResponse.json({ ok: true, jobs: jobs?.length || 0, events: events?.length || 0, pushed });
  } catch (e) {
    console.error("starting-soon crashed:", e);
    return NextResponse.json({ error: "starting-soon failed" }, { status: 500 });
  }
}
