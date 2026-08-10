import { supabaseAdmin } from "../../../lib/supabaseClient";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JobPhotos({ params }) {
  const { jobId } = params;
  const db = supabaseAdmin();

  const { data: job, error } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    notFound();
  }

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .eq("id", job.customer_id)
    .single();

  const { data: photos } = await db
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  const beforePhotos = (photos || []).filter((p) => p.label === "before");
  const afterPhotos = (photos || []).filter((p) => p.label === "after");

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Job photos</h1>
      </div>

      <section style={summaryCardStyle}>
        <div style={{ fontWeight: 600 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>{job.job_type || "Job"}</div>
      </section>

      <form
        action="/api/jobs/photos/upload"
        method="POST"
        encType="multipart/form-data"
        style={{ display: "grid", gap: 10, marginTop: 16 }}
      >
        <input type="hidden" name="jobId" value={job.id} />

        <label style={labelStyle}>
          Photo type
          <select name="label" defaultValue="before" style={inputStyle}>
            <option value="before">Before</option>
            <option value="after">After</option>
          </select>
        </label>

        <input
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          required
          style={{ fontSize: 14 }}
        />

        <button type="submit" style={uploadButtonStyle}>
          Add photo
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Before ({beforePhotos.length})</h2>
      {beforePhotos.length === 0 && (
        <p style={{ color: "#888", fontSize: 13 }}>No before photos yet.</p>
      )}
      <div style={galleryStyle}>
        {beforePhotos.map((photo) => (
          <div key={photo.id} style={photoCardStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Before" style={photoImgStyle} />
            <form action="/api/jobs/photos/delete" method="POST">
              <input type="hidden" name="photoId" value={photo.id} />
              <input type="hidden" name="jobId" value={job.id} />
              <button type="submit" style={deletePhotoButtonStyle}>
                Delete
              </button>
            </form>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>After ({afterPhotos.length})</h2>
      {afterPhotos.length === 0 && (
        <p style={{ color: "#888", fontSize: 13 }}>No after photos yet.</p>
      )}
      <div style={galleryStyle}>
        {afterPhotos.map((photo) => (
          <div key={photo.id} style={photoCardStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="After" style={photoImgStyle} />
            <form action="/api/jobs/photos/delete" method="POST">
              <input type="hidden" name="photoId" value={photo.id} />
              <input type="hidden" name="jobId" value={job.id} />
              <button type="submit" style={deletePhotoButtonStyle}>
                Delete
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}

const backButtonStyle = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#111",
};

const summaryCardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#666",
  fontWeight: 600,
};

const inputStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

const uploadButtonStyle = {
  background: "#111",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  fontSize: 15,
};

const galleryStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const photoCardStyle = {
  background: "white",
  borderRadius: 10,
  padding: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const photoImgStyle = {
  width: "100%",
  height: 120,
  objectFit: "cover",
  borderRadius: 6,
  display: "block",
  marginBottom: 6,
};

const deletePhotoButtonStyle = {
  width: "100%",
  background: "white",
  color: "#b91c1c",
  border: "1px solid #fca5a5",
  padding: "6px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
};
