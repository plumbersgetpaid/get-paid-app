import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything, canInvoice } from "../../lib/permissions";
import { filterJobsForMember } from "../../lib/jobAccess";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { getBusinessSettings } from "../../lib/getBusinessSettings";
import { NextResponse } from "next/server";

// The field pack: everything a tradesperson needs on site for the next
// 7 days, small enough to keep on the phone. FieldPackSync stores the
// response in IndexedDB whenever the app is online; /field renders it
// when the signal is gone. Text only - no photos - which keeps the pack
// tiny and the on-device data surface small (see docs/offline-plan.md).
//
// Visibility matches the rest of the app: owners and managers get the
// whole diary, a subcontractor's pack contains only jobs assigned or
// shared to them - the same filterJobsForMember the list pages use.

function londonDate(offsetDays) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  const d = new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const db = await getScopedDb(currentMember);
  const settings = await getBusinessSettings(currentMember.business_id);
  const from = londonDate(0);
  const to = londonDate(7);

  let jobsQuery = db
    .from("jobs")
    .select("id, job_type, status, amount, scheduled_start, scheduled_end, time_confirmed, location, customer_id, deposit_amount, deposit_received_on")
    .eq("status", "in_progress")
    .gte("scheduled_start", `${from}T00:00:00`)
    .lte("scheduled_start", `${to}T23:59:59`)
    .order("scheduled_start", { ascending: true });

  if (!canSeeEverything(currentMember)) {
    jobsQuery = await filterJobsForMember(db, jobsQuery, currentMember.id);
  }

  const { data: jobs, error } = await jobsQuery;
  if (error) {
    console.error("Field pack jobs error:", error);
    return NextResponse.json({ error: "Couldn't build the pack" }, { status: 500 });
  }

  const jobIds = (jobs || []).map((j) => j.id);
  const customerIds = [...new Set((jobs || []).map((j) => j.customer_id).filter(Boolean))];

  const [{ data: customers }, { data: notes }, { data: reminders }] = await Promise.all([
    customerIds.length
      ? db.from("customers").select("id, name, phone, address").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    jobIds.length
      ? db
          .from("job_notes")
          .select("job_id, note, important, created_at")
          .in("job_id", jobIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    db
      .from("personal_events")
      .select("id, title, notes, scheduled_start")
      .eq("created_by", currentMember.id)
      .gte("scheduled_start", `${from}T00:00:00`)
      .lte("scheduled_start", `${to}T23:59:59`)
      .order("scheduled_start", { ascending: true }),
  ]);

  const customerById = Object.fromEntries((customers || []).map((c) => [c.id, c]));
  const notesByJob = {};
  for (const n of notes || []) (notesByJob[n.job_id] ||= []).push(n);

  return NextResponse.json(
    {
      savedAt: new Date().toISOString(),
      // What the offline view may offer. canInvoice covers completing a
      // job (it raises the invoice); notes and photos need job access
      // only, which the pack's own scoping already guarantees.
      can: { complete: canInvoice(currentMember) },
      businessName: settings.business_name,
      // VAT entry mode, so the offline "Final amount" box can remind whoever
      // completes a job that a "+VAT" business adds VAT on top of the figure
      // they type (the server does the sum; this is only an on-screen hint).
      // Not sensitive - it's how prices are entered, not any customer's money.
      vat: {
        addOnTop: !!settings.vat_registered && settings.vat_price_entry === "exclusive",
        rate: Number(settings.vat_rate) || 20,
      },
      memberName: currentMember.name,
      from,
      to,
      jobs: (jobs || []).map((j) => ({
        id: j.id,
        jobType: j.job_type,
        // Money is owner/manager information, same rule as the Work screen.
        amount: canSeeEverything(currentMember) ? j.amount : null,
        // Deposit state (owner/manager only, like amount) so /field can flag
        // an outstanding deposit and show a deposit-aware completion confirm.
        depositAmount: canSeeEverything(currentMember) ? j.deposit_amount : null,
        depositReceivedOn: canSeeEverything(currentMember) ? j.deposit_received_on : null,
        start: j.scheduled_start,
        end: j.scheduled_end,
        timeConfirmed: j.time_confirmed !== false,
        location: j.location,
        customer: customerById[j.customer_id] || null,
        notes: (notesByJob[j.id] || []).slice(0, 10),
      })),
      reminders: reminders || [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
