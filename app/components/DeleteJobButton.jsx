"use client";

import { useState } from "react";

export default function DeleteJobButton({ jobId }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("jobId", jobId);
      const res = await fetch("/api/jobs/delete", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        window.location.href = "/work?tab=jobs";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't delete this job");
      setBusy(false);
    } catch (err) {
      console.error("Delete job error:", err);
      setError("Couldn't reach the server");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setShowConfirm(true)} style={deleteButtonStyle}>
        🗑️ Delete this job permanently
      </button>

      {showConfirm && (
        <div style={backdropStyle} onClick={() => !busy && setShowConfirm(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              Delete this job permanently?
            </div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              This can't be undone. The client record stays, but this job
              and its notes/photos are gone for good.
            </div>
            {error && (
              <div style={{ fontSize: 13, color: "#b91c1c", marginBottom: 12 }}>{error}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={busy}
                style={modalCancelButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={busy}
                style={modalConfirmButtonStyle}
              >
                {busy ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const deleteButtonStyle = {
  width: "100%",
  display: "block",
  textAlign: "center",
  background: "white",
  color: "#b91c1c",
  border: "1px solid #fca5a5",
  padding: "14px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 15,
};

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 20,
};

const modalStyle = {
  background: "white",
  borderRadius: 14,
  padding: 20,
  maxWidth: 340,
  width: "100%",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};

const modalCancelButtonStyle = {
  flex: 1,
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "12px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
};

const modalConfirmButtonStyle = {
  flex: 1,
  background: "#b91c1c",
  color: "white",
  border: "none",
  padding: "12px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
};
