import Link from "next/link";
import { getBusinessSettings } from "../lib/getBusinessSettings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Settings({ searchParams }) {
  const settings = await getBusinessSettings();
  const saved = searchParams?.saved === "1";

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
          Logo URL (optional)
          <input
            name="logo_url"
            placeholder="https://..."
            defaultValue={settings.logo_url || ""}
            style={inputStyle}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            A direct link to a PNG or JPG image. Leave blank to skip.
          </span>
        </label>

        <label style={labelStyle}>
          Invoice footer note (optional)
          <textarea
            name="invoice_note"
            placeholder="e.g. Payment terms, bank details, thank-you message"
            defaultValue={settings.invoice_note || ""}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <button type="submit" style={submitButtonStyle}>
          Save settings
        </button>
      </form>
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
