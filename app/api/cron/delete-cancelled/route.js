import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

// Deletes everything belonging to an account 30 days after it was
// cancelled, per the retention decision in CLAUDE.md. Kept: the
// subscriptions row and the business name, which together are the billing
// record held for 6 years for UK tax. Everything else goes - the
// tradesperson's clients, jobs, invoices, photos, team and settings.
//
// The customers in that data are homeowners who never signed up to
// anything. We are their processor, not their controller, and this is the
// job that makes the retention promise true rather than aspirational.
//
// Add ?dryRun=1 to see exactly what would go without deleting anything.

const RETENTION_DAYS = 30;
const PHOTO_BUCKETS = ["job-photos", "job-note-images"];

// Storage is emptied before the database, not after. The file paths are
// derived from job ids - once the job rows are gone there is nothing left
// pointing at the images, and they would sit in the bucket forever.
async function deleteStorageForJobs(db, jobIds, dryRun) {
  let found = 0;
  let removed = 0;

  for (const bucket of PHOTO_BUCKETS) {
    for (const jobId of jobIds) {
      const { data: files, error } = await db.storage.from(bucket).list(jobId, { limit: 1000 });
      if (error) {
        console.error(`Retention: listing ${bucket}/${jobId} failed:`, error.message);
        continue;
      }
      const paths = (files || []).map((f) => `${jobId}/${f.name}`);
      if (paths.length === 0) continue;
      found += paths.length;

      if (dryRun) continue;

      const { error: rmErr } = await db.storage.from(bucket).remove(paths);
      if (rmErr) console.error(`Retention: removing from ${bucket} failed:`, rmErr.message);
      else removed += paths.length;
    }
  }

  return { found, removed };
}

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const db = supabaseAdmin();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const { data: due, error } = await db
    .from("subscriptions")
    .select("business_id, canceled_at, status")
    .eq("status", "canceled")
    .not("canceled_at", "is", null)
    .lte("canceled_at", cutoff.toISOString());

  if (error) {
    console.error("Retention: could not list due accounts:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const sub of due || []) {
    const businessId = sub.business_id;

    // Job ids are needed for the storage paths, and must be read before
    // the rows are deleted.
    const { data: jobs } = await db.from("jobs").select("id").eq("business_id", businessId);
    const jobIds = (jobs || []).map((j) => j.id);

    const storage = await deleteStorageForJobs(db, jobIds, dryRun);

    if (dryRun) {
      const { count: customers } = await db
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId);
      const { count: invoices } = await db
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId);

      results.push({
        businessId,
        canceledAt: sub.canceled_at,
        wouldDelete: { jobs: jobIds.length, customers, invoices, files: storage.found },
      });
      continue;
    }

    // One transaction, ordered by the foreign keys. Either the whole
    // account goes or none of it does.
    const { data: counts, error: rpcErr } = await db.rpc("delete_business_data", {
      p_business_id: businessId,
    });

    if (rpcErr) {
      console.error(`Retention: deleting ${businessId} failed:`, rpcErr.message);
      results.push({ businessId, error: rpcErr.message });
      continue;
    }

    console.log(
      `Retention: deleted ${businessId} (cancelled ${sub.canceled_at}) -`,
      JSON.stringify(counts),
      `files removed: ${storage.removed}/${storage.found}`
    );
    results.push({ businessId, deleted: counts, filesRemoved: storage.removed });
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    retentionDays: RETENTION_DAYS,
    cutoff: cutoff.toISOString(),
    accounts: results.length,
    results,
  });
}
