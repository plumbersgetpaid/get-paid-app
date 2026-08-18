import { signPaths, RENDER_TTL } from "./signedMediaUrls";

// Fetches a job's before/after photos, grouped and ready to hand straight
// to generateInvoicePdfBytes. Used by every route that builds an invoice
// PDF, so photos consistently appear any time that invoice is generated -
// not just on the original send.
export async function getJobPhotosForPdf(db, jobId) {
  if (!jobId) return { beforePhotos: [], afterPhotos: [] };

  const { data: photos } = await db
    .from("job_photos")
    .select("storage_path, label")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  // Short-lived signed links: the PDF generator fetches these server-side
  // within this same request, so they never reach a browser and don't need
  // to outlive it.
  const signed = await signPaths(
    "job-photos",
    (photos || []).map((p) => p.storage_path),
    RENDER_TTL
  );
  const urlFor = (p) => signed.get(p.storage_path);

  const beforePhotos = (photos || [])
    .filter((p) => p.label === "before")
    .map(urlFor)
    .filter(Boolean);
  const afterPhotos = (photos || [])
    .filter((p) => p.label === "after")
    .map(urlFor)
    .filter(Boolean);

  return { beforePhotos, afterPhotos };
}
