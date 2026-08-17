"use client";

import { useState } from "react";
import { compressImage } from "../lib/compressImage";

export default function LogoUploadForm() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setBusy(true);

    try {
      let uploadFile = file;
      try {
        uploadFile = await compressImage(file, 800, 0.9, true);
      } catch (err) {
        console.error("Logo compression failed, using original:", err);
      }

      const formData = new FormData();
      formData.append("logo", uploadFile);

      const res = await fetch("/api/settings/upload-logo", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't upload the logo.");
        setBusy(false);
        return;
      }

      window.location.replace("/settings?saved=1");
    } catch (err) {
      console.error("Logo upload error:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10 }}>
      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 10,
            borderRadius: 8,
            fontSize: 12,
            flex: 1,
          }}
        >
          {error}
        </div>
      )}
      <input
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ flex: 1, fontSize: 13 }}
      />
      <button type="submit" disabled={busy || !file} style={uploadButtonStyle}>
        {busy ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}

const uploadButtonStyle = {
  background: "#111",
  color: "white",
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 13,
};
