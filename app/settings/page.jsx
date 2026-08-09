import Link from "next/link";
import { getBusinessSettings } from "../lib/getBusinessSettings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Settings({ searchParams }) {
  const settings = await getBusinessSettings();
  const saved = searchParams?.saved === "1";
  const uploadError = searchParams?.error;

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Business settings</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        This shows up on every quote, invoice, and reminder - your emails and
        PDFs update automatically.
      </p>

      <Link
        href="/settings/templates"
        style={{
          display: "block",
          background: "white",
          borderRadius: 12,
          padding: 16,
          margin: "16px 0",
          textDecoration: "none",
          color: "#111",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Message templates →</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
          Edit the wording of every automated quote, invoice, and reminder
        </div>
      </Link>

      {saved && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: 12,
            borderRadius: 8,
            margin: "16px 0",
            fontSize: 13,
          }}
        >
          Settings saved.
        </div>
      )}

      {uploadError && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 12,
            borderRadius: 8,
            margin: "16px 0",
            fontSize: 13,
          }}
        >
          Something went wrong uploading the logo. Try a smaller PNG or JPG file.
        </div>
      )}

      <form
        action="/api/settings"
        method="POST"
        style={{ display: "grid", gap: 14, marginTop: 16 }}
      >
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

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: "#666",
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            name="include_weekends"
            value="1"
            defaultChecked={settings.include_weekends}
          />
          Include weekends when booking multi-day jobs
          <span style={{ fontWeight: 400, color: "#888", fontSize: 12 }}>
            (off = a "week" means 5 working days)
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

        <button type="submit" style={submitButtonStyle}>
          Save settings
        </button>
      </form>

      <section
        style={{
          background: "white",
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Logo</div>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 12 }}>
          Shown on your PDF invoices. Best as a PNG with a transparent or white
          background.
        </p>

        {settings.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.logo_url}
            alt="Current logo"
            style={{ maxWidth: 160, maxHeight: 80, display: "block", marginBottom: 12 }}
          />
        )}

        <form
          action="/api/settings/upload-logo"
          method="POST"
          encType="multipart/form-data"
          style={{ display: "flex", gap: 10 }}
        >
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg"
            required
            style={{ flex: 1, fontSize: 13 }}
          />
          <button type="submit" style={uploadButtonStyle}>
            Upload
          </button>
        </form>
      </section>
    </main>
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

const backButtonStyle = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
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

const uploadButtonStyle = {
  background: "#111",
  color: "white",
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: "nowrap",
};
