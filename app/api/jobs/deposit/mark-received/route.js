import { getCurrentTeamMember } from "../../../../lib/auth";
import { canInvoice } from "../../../../lib/permissions";
import { canAccessJob } from "../../../../lib/jobAccess";
import { getScopedDb } from "../../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

// Records (or corrects) when a job's deposit actually arrived. The date is
// deliberately adjustable and backdatable: people mark things late, and the
// invoice is a financial record - it should say when the money moved, not
// when someone tapped a button. Locked once the final invoice exists (sent
// documents never quietly change).
export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const jobId = form.get("jobId");
  const receivedOn = (form.get("receivedOn") || "").toString().trim();

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) {
    return NextResponse.json({ error: "Pick the date the deposit arrived" }, { status: 400 });
  }
  // No future dates - a deposit can't have been received tomorrow.
  const today = new Date().toISOString().slice(0, 10);
  if (receivedOn > today) {
    return NextResponse.json({ error: "That date is in the future" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const { data: job } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!job.deposit_amount) {
    return NextResponse.json({ error: "No deposit was asked for on this job" }, { status: 400 });
  }

  // Once the final invoice exists, the deposit (and its date) is baked into
  // that document - corrections after that point would make the records
  // disagree with what the customer was sent.
  const { data: existingInvoice } = await db
    .from("invoices")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();
  if (existingInvoice) {
    return NextResponse.json(
      { error: "The final invoice has already been raised - the deposit is recorded on it and can't be changed here." },
      { status: 400 }
    );
  }

  const { error } = await db
    .from("jobs")
    .update({ deposit_received_on: receivedOn })
    .eq("id", jobId);
  if (error) {
    console.error("Mark deposit received error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/jobs/view/${jobId}`, req.url), 303);
}
