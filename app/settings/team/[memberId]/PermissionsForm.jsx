"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const PERMISSIONS = [
  {
    key: "can_invoice",
    label: "Can invoice",
    description: "Mark jobs done, send invoices, and manage the Invoices section.",
  },
  {
    key: "can_see_client_database",
    label: "Can see the client database",
    description:
      "Browse every client as its own section, not just client details on their assigned jobs.",
  },
  {
    key: "can_create_quote",
    label: "Can create new quotes",
    description: "Send price quotes to potential customers.",
  },
  {
    key: "can_create_job",
    label: "Can quick-book new jobs",
    description: "Book a job directly, without going through a quote first.",
  },
  {
    key: "can_create_recurring_job",
    label: "Can manage recurring jobs",
    description: "Set up and edit jobs that repeat automatically.",
  },
  {
    key: "can_reschedule",
    label: "Can reschedule jobs",
    description: "Change the booked-in date or time for a job.",
  },
];

export default function PermissionsForm({ member }) {
  const router = useRouter();

  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
  const [initial, setInitial] = useState(() =>
    Object.fromEntries(PERMISSIONS.map((p) => [p.key, !!member[p.key]]))
  );
  const [values, setValues] = useState(initial);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const changedKeys = PERMISSIONS.filter((p) => values[p.key] !== initial[p.key]).map(
    (p) => p.key
  );
  const hasChanges = changedKeys.length > 0;

  function toggle(key) {
    setValues((v) => ({ ...v, [key]: !v[key] }));
    setSaved(false);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("memberId", member.id);
      for (const p of PERMISSIONS) {
        form.append(p.key, values[p.key] ? "1" : "0");
      }
      const res = await fetch("/api/team/update-permissions", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save that");
        setBusy(false);
        return;
      }
      setInitial(values);
      setShowConfirm(false);
      setSaved(true);
      setBusy(false);
      router.refresh();
    } catch (err) {
      console.error("Update permissions error:", err);
      setError("Couldn't reach the server");
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {PERMISSIONS.map((p) => (
          <label key={p.key} style={toggleRowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{p.description}</div>
            </div>
            <input
              type="checkbox"
              checked={values[p.key]}
              onChange={() => toggle(p.key)}
              style={{ width: 20, height: 20, flexShrink: 0 }}
            />
          </label>
        ))}
      </div>

      {saved && !hasChanges && <div style={successBoxStyle}>Saved</div>}

      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={!hasChanges}
        style={hasChanges ? saveButtonStyle : saveButtonDisabledStyle}
      >
        Save changes
      </button>

      {showConfirm && (
        <div style={backdropStyle} onClick={() => !busy && setShowConfirm(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
              Confirm changes for {member.name}
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {changedKeys.map((key) => {
                const p = PERMISSIONS.find((x) => x.key === key);
                const turningOn = values[key];
                return (
                  <div key={key} style={changeRowStyle(turningOn)}>
                    {turningOn ? "✅ Turning ON" : "❌ Turning OFF"}: {p.label}
                  </div>
                );
              })}
            </div>
            {error && <div style={errorBoxStyle}>{error}</div>}
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
                onClick={handleConfirm}
                disabled={busy}
                style={modalConfirmButtonStyle}
              >
                {busy ? "Saving..." : "Confirm & save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const toggleRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: "white",
  borderRadius: 10,
  padding: 14,
};

const saveButtonStyle = {
  width: "100%",
  marginTop: 16,
  background: "#111",
  color: "white",
  border: "none",
  padding: "14px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 15,
};

const saveButtonDisabledStyle = {
  ...saveButtonStyle,
  background: "#ddd",
  color: "#888",
};

const successBoxStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
  marginTop: 12,
  textAlign: "center",
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 12,
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
  maxWidth: 360,
  width: "100%",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  maxHeight: "80vh",
  overflowY: "auto",
};

const changeRowStyle = (turningOn) => ({
  fontSize: 13,
  padding: "8px 10px",
  borderRadius: 8,
  background: turningOn ? "#dcfce7" : "#fee2e2",
  color: turningOn ? "#166534" : "#991b1b",
  fontWeight: 600,
});

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
  background: "#111",
  color: "white",
  border: "none",
  padding: "12px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
};
