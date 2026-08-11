"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "../../../lib/compressImage";

export default function AddNoteForm({ jobId }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [important, setImportant] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      let uploadFile = null;
      if (file) {
        try {
          uploadFile = await compressImage(file);
        } catch (err) {
          console.error("Note photo compression failed, using original:", err);
          uploadFile = file;
        }
      }

      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("note", note);
      if (important) formData.append("important", "1");
      if (uploadFile) formData.append("image", uploadFile);

      const res = await fetch("/api/jobs/notes/create", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't save that note.");
        setBusy(false);
        return;
      }

      setNote("");
      setImportant(false);
      setFile(null);
      setBusy(false);
      router.refresh();
    } catch (err) {
      console.error("Add note error:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
      {error && <div style={errorBoxStyle}>{error}</div>}
      <textarea
        placeholder="e.g. Don't forget to cap off pipes left in the wall before it's tiled"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        required
        style={textareaStyle}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={important}
          onChange={(e) => setImportant(e.target.checked)}
        />
        ⚠️ Flag as important
      </label>
      <label style={{ fontSize: 13, color: "#666" }}>
        Photo (optional) - for the team, never sent to the client
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: "block", fontSize: 14, marginTop: 6 }}
        />
      </label>
      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Saving..." : "Add note"}
      </button>
    </form>
  );
}

const textareaStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  fontFamily: "inherit",
};

const submitButtonStyle = {
  background: "#111",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  fontSize: 15,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 8,
  fontSize: 13,
};
