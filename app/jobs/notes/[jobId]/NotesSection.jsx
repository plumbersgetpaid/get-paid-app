"use client";

import { useState, useEffect, useCallback } from "react";
import { compressImage } from "../../../lib/compressImage";

function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    if (a.important !== b.important) return a.important ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

export default function NotesSection({ jobId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [note, setNote] = useState("");
  const [important, setImportant] = useState(false);
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/notes/list?jobId=${jobId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || "Couldn't load notes.");
      } else {
        setLoadError(null);
        setNotes(sortNotes(data.notes || []));
      }
    } catch (e) {
      console.error("Load notes error:", e);
      setLoadError("Couldn't reach the server.");
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

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
      setFileInputKey((k) => k + 1);
      setBusy(false);
      await loadNotes();
    } catch (err) {
      console.error("Add note error:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function handleDelete(noteId) {
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== noteId)); // instant, don't wait on the server

    try {
      const formData = new FormData();
      formData.append("noteId", noteId);
      const res = await fetch("/api/jobs/notes/delete", { method: "POST", body: formData });
      if (!res.ok) {
        setNotes(previous); // put it back if the delete actually failed
      }
    } catch (e) {
      console.error("Delete note error:", e);
      setNotes(previous);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {error && <div style={errorBoxStyle}>{error}</div>}
        <textarea
          placeholder="Type a note for the team..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          required
          autoFocus
          style={textareaStyle}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
            />
            ⚠️ Important
          </label>
          <button
            type="submit"
            disabled={busy || !note.trim()}
            style={{ ...submitButtonStyle, marginLeft: "auto" }}
          >
            {busy ? "Saving..." : "Add"}
          </button>
        </div>
        <label style={{ fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 8 }}>
          📷 Photo
          <input
            key={fileInputKey}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ fontSize: 12, flex: 1 }}
          />
        </label>
      </form>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Notes ({notes.length})</h2>

      {loading && <p style={{ color: "#888", fontSize: 13 }}>Loading...</p>}
      {loadError && <div style={errorBoxStyle}>{loadError}</div>}
      {!loading && !loadError && notes.length === 0 && (
        <p style={{ color: "#888", fontSize: 13 }}>No notes yet.</p>
      )}

      {notes.map((n) => (
        <div key={n.id} style={n.important ? importantNoteCardStyle : noteCardStyle}>
          {n.important && (
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 12, marginBottom: 4 }}>
              ⚠️ Important
            </div>
          )}
          <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{n.note}</div>
          {n.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.image_url} alt="" style={noteImageStyle} />
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "#888" }}>
              {new Date(n.created_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button type="button" onClick={() => handleDelete(n.id)} style={deleteNoteButtonStyle}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
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
  padding: "8px 20px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 14,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 8,
  fontSize: 13,
};

const noteCardStyle = {
  background: "white",
  borderRadius: 10,
  padding: 14,
  marginBottom: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const importantNoteCardStyle = {
  ...noteCardStyle,
  background: "#fef3c7",
  border: "1px solid #fde68a",
};

const noteImageStyle = {
  width: "100%",
  maxWidth: 240,
  borderRadius: 8,
  marginTop: 8,
  display: "block",
};

const deleteNoteButtonStyle = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: "none",
  borderRadius: 6,
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
