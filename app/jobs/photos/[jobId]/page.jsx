import { notFound } from "next/navigation";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canAccessJob } from "../../../lib/jobAccess";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import BackButton from "../../../components/BackButton";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function JobPhotos(props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { jobId } = params;

  // This page previously had no login lookup at all - middleware
  // already required a session to reach it, but the scoped client below
  // specifically needs to know whose business to scope to, so this is
  // now required rather than optional.
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    notFound();
  }

  const db = await getScopedDb(currentMember);

  const { data: job, error } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    notFound();
  }

  // This page previously had no per-job access check at all - any
  // logged-in team member, regardless of permissions or assignment,
  // could view or add photos on any job in the business. Same shared
  // check used everywhere else a job's own access needs confirming:
  // owner/manager, the direct assignee, or anyone it's been shared with.
  const hasAccess = await canAccessJob(db, job, currentMember);
  if (!hasAccess) {
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
        <BackButton fallbackHref="/work?tab=jobs" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Job photos</h1>
      </div>

      <section style={summaryCardStyle}>
        <div style={{ fontWeight: 500 }}>{customer?.name || "Customer"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>{job.job_type || "Job"}</div>
      </section>

      {searchParams?.error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 12,
            borderRadius: 2,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          Couldn't upload that photo: {searchParams.error}
        </div>
      )}

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

      <h2 style={{ fontSize: 16, fontWeight: 500, marginTop: 24 }}>Before ({beforePhotos.length})</h2>
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

      <h2 style={{ fontSize: 16, fontWeight: 500, marginTop: 24 }}>After ({afterPhotos.length})</h2>
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

const summaryCardStyle = {
  background: "white",
  borderRadius: 3,
  padding: 16,
  margin: "16px 0",
  border: "1px solid #e2e2e2",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#666",
  fontWeight: 500,
};

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

const uploadButtonStyle = {
  background: "#000",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  fontSize: 15,
};

const galleryStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const photoCardStyle = {
  background: "white",
  borderRadius: 2,
  padding: 8,
  border: "1px solid #e2e2e2",
};

const photoImgStyle = {
  width: "100%",
  height: 120,
  objectFit: "cover",
  borderRadius: 2,
  display: "block",
  marginBottom: 6,
};

const deletePhotoButtonStyle = {
  width: "100%",
  background: "white",
  color: "#b91c1c",
  border: "1px solid #fca5a5",
  padding: "6px",
  borderRadius: 2,
  fontSize: 12,
  fontWeight: 500,
};
