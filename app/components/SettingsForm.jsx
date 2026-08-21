"use client";

import { useState } from "react";

export default function SettingsForm({ settings }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [vatOn, setVatOn] = useState(!!settings.vat_registered);

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

      // replace(), not a plain href assignment - this page IS /settings
      // already, so navigating "to" itself with href would stack a
      // second history entry on top of the one already there, meaning
      // a single tap of Back would only pop that duplicate and appear
      // to do nothing at all
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
        Currency
        <select name="currency" defaultValue={settings.currency} style={inputStyle}>
          <option value="GBP">£ GBP - British Pound</option>
          <option value="USD">$ USD - US Dollar</option>
          <option value="EUR">€ EUR - Euro</option>
        </select>
      </label>

      <div style={{ border: "1px solid #e2e2e2", borderRadius: 4, padding: 14, display: "grid", gap: 12 }}>
        <label style={{ ...labelStyle, flexDirection: "row", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            name="vat_registered"
            value="1"
            checked={vatOn}
            onChange={(e) => setVatOn(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span>
            VAT registered
            <span style={{ display: "block", fontWeight: 400, color: "#888", fontSize: 12 }}>
              Turn this on to show a VAT breakdown and your VAT number on
              invoices and quotes.
            </span>
          </span>
        </label>

        {vatOn && (
          <>
            <label style={labelStyle}>
              VAT number
              <input
                name="vat_number"
                placeholder="e.g. GB123456789"
                defaultValue={settings.vat_number || ""}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              VAT rate (%)
              <input
                name="vat_rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={settings.vat_rate ?? 20}
                style={inputStyle}
              />
              <span style={{ fontWeight: 400, color: "#888", fontSize: 12 }}>
                Standard UK rate is 20%.
              </span>
            </label>
            <label style={labelStyle}>
              When you type a price
              <select
                name="vat_price_entry"
                defaultValue={settings.vat_price_entry || "inclusive"}
                style={inputStyle}
              >
                <option value="inclusive">
                  It's the total the customer pays (VAT already included)
                </option>
                <option value="exclusive">
                  It's before VAT - add VAT on top for me
                </option>
              </select>
              <span style={{ fontWeight: 400, color: "#888", fontSize: 12 }}>
                Quote homeowners a total price? Keep the first option. Quote
                commercial work as "£500 + VAT"? Pick the second and PatchUp
                does the maths - type 500 and the quote goes out as 600.
              </span>
            </label>
          </>
        )}
      </div>

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
        Bank details (optional - shown on every invoice, and how deposits get paid)
        <textarea
          name="bank_details"
          placeholder={"e.g. Sort code: 00-00-00\nAccount number: 12345678"}
          defaultValue={settings.bank_details || ""}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      <label style={labelStyle}>
        Accent colour (used on PDF invoices)
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            name="accent_color"
            type="color"
            defaultValue={settings.accent_color}
            style={{ width: 48, height: 40, padding: 0, border: "1px solid #e2e2e2", borderRadius: 8 }}
          />
          <span style={{ fontSize: 13, color: "#888" }}>{settings.accent_color}</span>
        </div>
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
  fontWeight: 500,
};

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  fontWeight: 400,
  color: "#000",
};

const submitButtonStyle = {
  background: "#000",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  fontSize: 15,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
};
