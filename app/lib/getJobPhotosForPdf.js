// Fetches a job's before/after photos, grouped and ready to hand straight
// to generateInvoicePdfBytes. Used by every route that builds an invoice
// PDF, so photos consistently appear any time that invoice is generated -
// not just on the original send.
export async function getJobPhotosForPdf(db, jobId) {
  if (!jobId) return { beforePhotos: [], afterPhotos: [] };

  const { data: photos } = await db
    .from("job_photos")
    .select("url, label")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  const beforePhotos = (photos || []).filter((p) => p.label === "before").map((p) => p.url);
  const afterPhotos = (photos || []).filter((p) => p.label === "after").map((p) => p.url);

  return { beforePhotos, afterPhotos };
}
