"use client";

import { useState } from "react";

export default function SettingsForm({ settings }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const formData = new FormData(e.target);

    try {
      const res = await fetch("/api/settings", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong saving this.");
        setBusy(false);
        return;
      }

      window.location.replace("/settings?saved=1");
    } catch (err) {
      console.error("Save settings error:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, marginTop: 16 }}>
      {error && <div style={errorBoxStyle}>{error}</div>}

      <input type="hidden" name="logo_url" value={settings.logo_url || ""} />

      <label style={labelStyle}>
        Business name
        <input
          name="business_name"
          defaultValue={settings.business_name}
          required
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Header tagline (optional, shown under your business name on PDFs)
        <input
          name="header_tagline"
          placeholder="e.g. Professional Plumbing & Heating Services"
          defaultValue={settings.header_tagline || ""}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Contact email (shown to customers)
        <input
          name="contact_email"
          type="email"
          defaultValue={settings.contact_email || ""}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Contact phone
        <input
          name="contact_phone"
          defaultValue={settings.contact_phone || ""}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Accent colour (used on PDF invoices)
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            name="accent_color"
            type="color"
            defaultValue={settings.accent_color}
            style={{ width: 48, height: 40, padding: 0, border: "1px solid #ddd", borderRadius: 8 }}
          />
          <span style={{ fontSize: 13, color: "#888" }}>{settings.accent_color}</span>
        </div>
      </label>

      <label style={labelStyle}>
        Currency
        <select name="currency" defaultValue={settings.currency} style={inputStyle}>
          <option value="GBP">£ GBP - British Pound</option>
          <option value="USD">$ USD - US Dollar</option>
          <option value="EUR">€ EUR - Euro</option>
        </select>
      </label>

      <label style={labelStyle}>
        Google review link (optional)
        <input
          name="google_review_link"
          type="url"
          placeholder="https://g.page/r/your-business/review"
          defaultValue={settings.google_review_link || ""}
          style={inputStyle}
        />
        <span style={{ fontWeight: 400, color: "#888", fontSize: 12 }}>
          Find this in your Google Business Profile - once set, paid
          customers automatically get a thank-you with this link. Leave
          blank to turn this off.
        </span>
      </label>

      <label style={labelStyle}>
        Payment terms (optional, shown on every invoice)
        <textarea
          name="payment_terms"
          placeholder="e.g. Payment due within 14 days of invoice date"
          defaultValue={settings.payment_terms || ""}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      <label style={labelStyle}>
        Bank details (optional, shown on every invoice)
        <textarea
          name="bank_details"
          placeholder={"e.g. Sort code: 00-00-00\nAccount number: 12345678"}
          defaultValue={settings.bank_details || ""}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      <label style={labelStyle}>
        Invoice footer note (optional)
        <textarea
          name="invoice_note"
          placeholder="e.g. thank-you message, extra notes"
          defaultValue={settings.invoice_note || ""}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}

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
