"use client";

import { useRef, useState } from "react";
import { compressImage } from "../../../lib/compressImage";
import { queueAction } from "../../../lib/outbox";

// Before/after photo upload, offline-capable: with signal it posts
// straight through; without, the photo is stored on the phone and sent
// automatically when the connection returns.
export default function PhotoUploadForm({ jobId }) {
  const requestIdRef = useRef(null);
  const [label, setLabel] = useState("before");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    let uploadFile = file;
    try {
      uploadFile = await compressImage(file, 1600, 0.8);
    } catch {}

    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    const formData = new FormData();
    formData.append("jobId", jobId);
    formData.append("label", label);
    formData.append("photo", uploadFile, file.name || "photo.jpg");
    formData.append("request_id", requestIdRef.current);

    let res;
    try {
      res = await fetch("/api/jobs/photos/upload", { method: "POST", body: formData });
    } catch {
      const ok = await queueAction({
        requestId: requestIdRef.current,
        endpoint: "/api/jobs/photos/upload",
        label: `${label === "after" ? "After" : "Before"} photo`,
        formData,
      }).catch(() => false);
      if (ok) {
        requestIdRef.current = null;
        setFile(null);
        setFileKey((k) => k + 1);
        setNotice("No signal - photo saved on this phone, it'll upload when you're back online.");
      } else {
        setError("Couldn't reach the server and this phone's offline storage is full.");
      }
      setBusy(false);
      return;
    }

    requestIdRef.current = null;
    setBusy(false);
    // Server-rendered gallery: a full reload shows the new photo (or the
    // route's ?error= message).
    window.location.href = res.url || `/jobs/photos/${jobId}`;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
      <label style={labelStyle}>
        Photo type
        <select value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle}>
          <option value="before">Before</option>
          <option value="after">After</option>
        </select>
      </label>

      <input
        key={fileKey}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ fontSize: 14 }}
      />

      {error && <div style={noticeStyle("#fee2e2", "#991b1b")}>{error}</div>}
      {notice && <div style={noticeStyle("#111", "white")}>{notice}</div>}

      <button type="submit" disabled={busy || !file} style={uploadButtonStyle}>
        {busy ? "Saving..." : "Add photo"}
      </button>
    </form>
  );
}

const labelStyle = { display: "grid", gap: 4, fontSize: 13, color: "#444" };
const inputStyle = { padding: "10px 12px", border: "1px solid #ddd", borderRadius: 4, fontSize: 14, fontFamily: "inherit" };
const uploadButtonStyle = { background: "#000", color: "white", padding: "12px", borderRadius: 2, border: "none", fontWeight: 500, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" };
const noticeStyle = (bg, fg) => ({ background: bg, color: fg, padding: 10, borderRadius: 6, fontSize: 12.5 });
