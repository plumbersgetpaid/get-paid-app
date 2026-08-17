import BackButton from "../../components/BackButton";
import AppLogoUploadForm from "./AppLogoUploadForm";
import { getPlatformSettings } from "../../lib/getPlatformSettings";
import { getCurrentTeamMember } from "../../lib/auth";
import { isPlatformAdmin } from "../../lib/permissions";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function AdminBranding({ searchParams }) {
  const currentMember = await getCurrentTeamMember();
  if (!isPlatformAdmin(currentMember)) {
    notFound();
  }

  const settings = await getPlatformSettings();
  const savedApp = searchParams?.saved === "app";
  const savedSignoff = searchParams?.saved === "signoff";

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Platform branding</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8, marginBottom: 16 }}>
        Two separate logos for the app itself, independent of any
        individual business&apos;s own logo in Business settings, and
        only visible to platform admins.
      </p>

      <section style={cardStyle}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>App logo</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 12 }}>
          Shown on the login and setup screens. Best as a PNG with a
          transparent or white background.
        </p>

        {savedApp && (
          <div style={successBannerStyle}>Logo updated - now live on the login screen.</div>
        )}

        {settings.app_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.app_logo_url}
            alt="Current app logo"
            style={{ maxWidth: 160, maxHeight: 80, display: "block", marginBottom: 12 }}
          />
        ) : (
          <p style={{ fontSize: 12, color: "#b45309", marginBottom: 12 }}>
            No logo uploaded yet - the login screen currently shows the
            plain "Patch Up" text instead.
          </p>
        )}

        <AppLogoUploadForm uploadEndpoint="/api/admin/upload-app-logo" savedParam="app" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Sign-off logo</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 12 }}>
          The small, subtle mark shown at the bottom of the Today page.
          Independent of the app logo above - can be the same image or
          a different one, e.g. just the icon on its own rather than
          the full logo with wordmark.
        </p>

        {savedSignoff && (
          <div style={successBannerStyle}>Logo updated - now live on the Today page.</div>
        )}

        {settings.sign_off_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.sign_off_logo_url}
            alt="Current sign-off logo"
            style={{ maxWidth: 160, maxHeight: 80, display: "block", marginBottom: 12 }}
          />
        ) : (
          <p style={{ fontSize: 12, color: "#b45309", marginBottom: 12 }}>
            No logo uploaded yet - the Today page currently shows the
            built-in icon mark instead.
          </p>
        )}

        <AppLogoUploadForm uploadEndpoint="/api/admin/upload-signoff-logo" savedParam="signoff" />
      </section>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const successBannerStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 12,
};
