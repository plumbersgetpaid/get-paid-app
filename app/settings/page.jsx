import Link from "next/link";
import BackButton from "../components/BackButton";
import LogoUploadForm from "../components/LogoUploadForm";
import SettingsForm from "../components/SettingsForm";
import LogoutButton from "../components/LogoutButton";
import { getBusinessSettings } from "../lib/getBusinessSettings";
import { getCurrentTeamMember } from "../lib/auth";
import { canSeeEverything } from "../lib/permissions";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Settings({ searchParams }) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  const settings = await getBusinessSettings();
  const saved = searchParams?.saved === "1";
  const uploadError = searchParams?.error;

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Business settings</h1>
      </div>

      {currentMember && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "white",
            borderRadius: 12,
            padding: 14,
            margin: "16px 0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: "#888" }}>Logged in as</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {currentMember.name} · {currentMember.email}
            </div>
          </div>
          <LogoutButton />
        </div>
      )}

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

      <Link
        href="/settings/team"
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>Team →</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
          Add people, set their role, or remove access
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

      {searchParams?.testSent === "1" && (
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
          Test sent to {settings.contact_email || "your WhatsApp"} - check it arrived, and
          that the review link is a real clickable link.
        </div>
      )}

      {searchParams?.testSent === "0" && (
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
          Couldn't send the test email
          {searchParams?.testErrorMsg ? `: ${searchParams.testErrorMsg}` : "."}
        </div>
      )}

      {searchParams?.testError === "nolink" && (
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
          Add a Google review link below first, then try the test again.
        </div>
      )}

      {searchParams?.testError === "nocontact" && (
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
          Add a contact email or phone below first, so there's somewhere to
          send the test to.
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

      <SettingsForm settings={settings} />

      <form
        action="/api/settings/test-review-request"
        method="POST"
        style={{ marginTop: 16 }}
      >
        <button type="submit" style={testButtonStyle}>
          📨 Send a test review request to yourself
        </button>
        <p style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
          Uses whatever's currently saved above - handy for checking the
          review link works before it goes out to real customers.
        </p>
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

        <LogoUploadForm />
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

const testButtonStyle = {
  width: "100%",
  background: "white",
  color: "#111",
  padding: "12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontWeight: 600,
  fontSize: 14,
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
