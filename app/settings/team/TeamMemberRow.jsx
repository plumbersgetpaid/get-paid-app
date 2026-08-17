"use client";

import { useState } from "react";
import DeleteTeamMemberButton from "../../components/DeleteTeamMemberButton";

export default function TeamMemberRow({ member, isSelf }) {
  const [role, setRole] = useState(member.role);
  const [isActive, setIsActive] = useState(member.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const locked = isSelf || member.role === "owner";

  async function handleRoleChange(e) {
    const newRole = e.target.value;
    const previous = role;
    setRole(newRole);
    setError(null);
    setBusy(true);

    try {
      const form = new FormData();
      form.append("memberId", member.id);
      form.append("role", newRole);
      const res = await fetch("/api/team/update-role", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't update role");
        setRole(previous);
      }
    } catch (err) {
      console.error("Update role error:", err);
      setError("Couldn't reach the server");
      setRole(previous);
    }
    setBusy(false);
  }

  async function handleToggleActive() {
    const newActive = !isActive;
    setError(null);
    setBusy(true);

    try {
      const form = new FormData();
      form.append("memberId", member.id);
      form.append("isActive", newActive ? "1" : "0");
      const res = await fetch("/api/team/toggle-active", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't update that");
      } else {
        setIsActive(newActive);
      }
    } catch (err) {
      console.error("Toggle active error:", err);
      setError("Couldn't reach the server");
    }
    setBusy(false);
  }

  return (
    <div style={cardStyle(isActive)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 500 }}>
            {member.name} {isSelf && <span style={{ color: "#888", fontWeight: 400 }}>(you)</span>}
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>{member.email}</div>
        </div>
        {!isActive && <span style={inactiveBadgeStyle}>Deactivated</span>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        {locked ? (
          <span style={{ fontSize: 13, textTransform: "capitalize", color: "#666" }}>
            {member.role}
          </span>
        ) : (
          <select value={role} onChange={handleRoleChange} disabled={busy} style={selectStyle}>
            <option value="manager">Manager</option>
            <option value="subcontractor">Subcontractor</option>
          </select>
        )}

        {!locked && (
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={busy}
            style={isActive ? deactivateButtonStyle : activateButtonStyle}
          >
            {isActive ? "Deactivate" : "Reactivate"}
          </button>
        )}

        {/* Granular permissions only ever apply to a subcontractor - an
            owner/manager already has everything, so this link only
            shows for the role it actually means something for. Reacts
            to the live role state, not member.role, so it appears or
            disappears immediately if the dropdown above is changed,
            without needing a full page reload. */}
        {role === "subcontractor" && (
          <a href={`/settings/team/${member.id}`} style={permissionsLinkStyle}>
            Permissions
          </a>
        )}

        {/* Permanent deletion only ever shows once someone's already
            deactivated - a deliberate two-step process for something
            this destructive, matching how it was actually asked for:
            delete as a follow-up to deactivating someone, not an
            alternative to it. Reacts to the live isActive state, so it
            appears the moment Deactivate is tapped, no reload needed. */}
        {!locked && !isActive && (
          <DeleteTeamMemberButton memberId={member.id} memberName={member.name} />
        )}
      </div>

      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

const cardStyle = (isActive) => ({
  background: "white",
  borderRadius: 2,
  padding: 14,
  marginBottom: 8,
  opacity: isActive ? 1 : 0.7,
});

const inactiveBadgeStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: "#991b1b",
  background: "#fee2e2",
  padding: "3px 8px",
  borderRadius: 999,
};

const selectStyle = {
  fontSize: 13,
  padding: "6px 10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  color: "#000",
  background: "white",
};

const deactivateButtonStyle = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 2,
  border: "1px solid #fca5a5",
  color: "#b91c1c",
  background: "white",
  fontWeight: 500,
};

const activateButtonStyle = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  color: "#000",
  background: "white",
  fontWeight: 500,
};

const errorTextStyle = {
  fontSize: 12,
  color: "#dc2626",
  marginTop: 6,
};

const permissionsLinkStyle = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  color: "#000",
  background: "white",
  fontWeight: 500,
  textDecoration: "none",
};
