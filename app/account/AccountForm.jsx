"use client";

import { useState } from "react";

export default function AccountForm({ currentName, currentEmail }) {
  const [name, setName] = useState(currentName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSaved, setEmailSaved] = useState(false);

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

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setEmailError(null);
    setEmailSaved(false);
    setEmailBusy(true);

    try {
      const form = new FormData();
      form.append("newEmail", email);
      form.append("currentPassword", emailPassword);
      const res = await fetch("/api/account/update-email", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailError(data.error || "Couldn't save that");
      } else {
        setEmailSaved(true);
        setEmailPassword("");
      }
    } catch (err) {
      console.error("Update email error:", err);
      setEmailError("Couldn't reach the server");
    }
    setEmailBusy(false);
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
        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Your name</div>
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
        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Your email</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#888" }}>Current email</div>
          <div style={{ fontSize: 15 }}>{currentEmail}</div>
        </div>
        <form
          onSubmit={handleEmailSubmit}
          style={{ display: "grid", gap: 10 }}
        >
          <label style={labelStyle}>
            New email
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailSaved(false);
              }}
              placeholder="e.g. name@example.com"
              required
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Current password, to confirm
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          </label>
          {emailError && <div style={errorBoxStyle}>{emailError}</div>}
          {emailSaved && <div style={successBoxStyle}>Email updated</div>}
          <div style={{ fontSize: 12, color: "#888" }}>
            This is what you log in with - changing it takes effect the
            next time you sign in, so make sure you'll remember the new one.
          </div>
          <button
            type="submit"
            disabled={emailBusy || !email.trim() || !emailPassword}
            style={submitButtonStyle}
          >
            {emailBusy ? "Saving..." : "Save email"}
          </button>
        </form>
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Change password</div>
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
        {/* For someone who's been logged in a while via the persistent
            session and has genuinely forgotten their actual password -
            the form above is a dead end for them since it needs the
            current one. A plain anchor, not Link, matching the same
            approach used on the login page after Link caused a crash
            there. */}
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <a href="/forgot-password?from=account" style={forgotLinkStyle}>
            Forgotten your current password? Reset it by email instead
          </a>
        </div>
      </section>
    </>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: "var(--card-pad, 16px)",
  margin: "16px 0",
  border: "1px solid #e2e2e2",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#666",
  fontWeight: 500,
};

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  fontWeight: 400,
  color: "#000",
  width: "100%",
  boxSizing: "border-box",
};

const submitButtonStyle = {
  background: "#000",
  color: "white",
  padding: "12px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  fontSize: 14,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 10,
  borderRadius: 2,
  fontSize: 13,
};

const forgotLinkStyle = {
  fontSize: 12,
  color: "#666",
  textDecoration: "underline",
};

const successBoxStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 10,
  borderRadius: 2,
  fontSize: 13,
};
