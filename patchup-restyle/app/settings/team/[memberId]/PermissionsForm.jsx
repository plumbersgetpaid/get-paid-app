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

  // Pressing the phone's physical back button (rather than an in-app
  // link) can restore this page as a frozen snapshot from the exact
  // moment it was left - the browser's own back-forward cache, which
  // operates below Next.js's own router and isn't reachable by either
  // the Cache-Control header or router.refresh() above. The pageshow
  // event with persisted=true is the standard, reliable way to detect
  // this specific case. A permissions screen showing stale data is a
  // real correctness problem, not just a cosmetic one - worth a brief,
  // visible reload to guarantee this always reflects what was actually
  // just saved, rather than a snapshot from before it.
  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
  // initial is its own state, not a plain derived constant - it needs
  // to be updated after a successful save so "unsaved changes" gets
  // recalculated against what was actually just saved, not what the
  // page originally loaded with. Without this, the "Saved" confirmation
  // could never show: values would keep permanently differing from a
  // stale initial, so hasChanges would stay true forever after saving.
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
      // Tells Next.js's own internal page cache that this route's data
      // just changed server-side, so it re-fetches fresh next time
      // rather than serving a snapshot from before this save - separate
      // from the browser-level Cache-Control fix, since this is a
      // different caching layer Next.js manages itself for fast
      // back/forward navigation, and that fix alone doesn't reach it
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
              <div style={{ fontWeight: 500, fontSize: 14 }}>{p.label}</div>
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
            <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 10 }}>
              Confirm changes for {member.name}
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {changedKeys.map((key) => {
                const p = PERMISSIONS.find((x) => x.key === key);
                const turningOn = values[key];
                return (
                  <div key={key} style={changeRowStyle(turningOn)}>
                    {turningOn ? "Turning ON" : "Turning OFF"}: {p.label}
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
  borderRadius: 2,
  padding: 14,
};

const saveButtonStyle = {
  width: "100%",
  marginTop: 16,
  background: "#000",
  color: "white",
  border: "none",
  padding: "14px",
  borderRadius: 2,
  fontWeight: 500,
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
  borderRadius: 2,
  fontSize: 13,
  marginTop: 12,
  textAlign: "center",
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 10,
  borderRadius: 2,
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
  borderRadius: 3,
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
  borderRadius: 2,
  background: turningOn ? "#dcfce7" : "#fee2e2",
  color: turningOn ? "#166534" : "#991b1b",
  fontWeight: 500,
});

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
  background: "#000",
  color: "white",
  border: "none",
  padding: "12px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 14,
};
