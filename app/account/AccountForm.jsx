"use client";

import { useState } from "react";

export default function AccountForm({ currentName }) {
  const [name, setName] = useState(currentName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleNameSubmit(e) {
    e.preventDefault();
    setNameError(null);
    setNameSaved(false);
    setNameBusy(true);

    try {
      const form = new FormData();
      form.append("name", name);
      const res = await fetch("/api/account/update-name", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNameError(data.error || "Couldn't save that");
      } else {
        setNameSaved(true);
      }
    } catch (err) {
      console.error("Update name error:", err);
      setNameError("Couldn't reach the server");
    }
    setNameBusy(false);
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    setPasswordBusy(true);
    try {
      const form = new FormData();
      form.append("currentPassword", currentPassword);
      form.append("newPassword", newPassword);
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError(data.error || "Couldn't change your password");
      } else {
        setPasswordSaved(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("Change password error:", err);
      setPasswordError("Couldn't reach the server");
    }
    setPasswordBusy(false);
  }

  return (
    <>
      <section style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Your name</div>
        <form onSubmit={handleNameSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameSaved(false);
            }}
            required
            style={inputStyle}
          />
          {nameError && <div style={errorBoxStyle}>{nameError}</div>}
          {nameSaved && <div style={successBoxStyle}>Saved</div>}
          <button type="submit" disabled={nameBusy || !name.trim()} style={submitButtonStyle}>
            {nameBusy ? "Saving..." : "Save name"}
          </button>
        </form>
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Change password</div>
        <form onSubmit={handlePasswordSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              style={inputStyle}
            />
          </label>
          {passwordError && <div style={errorBoxStyle}>{passwordError}</div>}
          {passwordSaved && <div style={successBoxStyle}>Password changed</div>}
          <button
            type="submit"
            disabled={passwordBusy || !currentPassword || !newPassword}
            style={submitButtonStyle}
          >
            {passwordBusy ? "Saving..." : "Change password"}
          </button>
        </form>
      </section>
    </>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#666",
  fontWeight: 600,
};

const inputStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  fontWeight: 400,
  color: "#111",
  width: "100%",
  boxSizing: "border-box",
};

const submitButtonStyle = {
  background: "#111",
  color: "white",
  padding: "12px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  fontSize: 14,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
};

const successBoxStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
};
