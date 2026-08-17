"use client";

import { useState } from "react";

export default function DeleteTeamMemberButton({ memberId, memberName }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("memberId", memberId);
      const res = await fetch("/api/team/delete", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        window.location.href = "/settings/team";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't delete this account");
      setBusy(false);
    } catch (err) {
      console.error("Delete team member error:", err);
      setError("Couldn't reach the server");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setShowConfirm(true)} style={deleteButtonStyle}>
        Delete permanently
      </button>

      {showConfirm && (
        <div style={backdropStyle} onClick={() => !busy && setShowConfirm(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 8 }}>
              Permanently delete {memberName}?
            </div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              This can't be undone. Their name will be cleared from any
              past jobs, quotes, and notes, but those records themselves
              stay exactly as they are - nothing gets deleted except
              their own account and any private reminders of theirs.
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
                {busy ? "Deleting..." : "Yes, delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const deleteButtonStyle = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 2,
  border: "1px solid #fca5a5",
  color: "#b91c1c",
  background: "white",
  fontWeight: 500,
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
  borderRadius: 3,
  padding: 20,
  maxWidth: 340,
  width: "100%",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};

const modalCancelButtonStyle = {
  flex: 1,
  background: "white",
  color: "#000",
  border: "1px solid #e2e2e2",
  padding: "12px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 14,
};

const modalConfirmButtonStyle = {
  flex: 1,
  background: "#b91c1c",
  color: "white",
  border: "none",
  padding: "12px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 14,
};
