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
  // A 404, not a redirect to login - someone without this specific
  // flag shouldn't even learn this page exists, the same reasoning
  // used for Settings but one level more restrictive, since this
  // affects every business on the platform rather than just one
  const currentMember = await getCurrentTeamMember();
  if (!isPlatformAdmin(currentMember)) {
    notFound();
  }

  const settings = await getPlatformSettings();
  const savedApp = searchParams?.saved === "app";
  const savedSignoff = searchParams?.saved === "signoff";
  const savedFavicon = searchParams?.saved === "favicon";

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Platform branding</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8, marginBottom: 16 }}>
        Two separate logos for the app itself, independent of any
        individual business&apos;s own logo in Business settings, and
        only visible to platform admins.
      </p>

      <section style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>App logo</h2>
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
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>Sign-off logo</h2>
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

      <section style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>Favicon</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 12 }}>
          The small icon in the browser tab. It renders at about 16
          pixels, so use the emblem on its own - a logo with the wordmark
          in it turns to mush at that size. Square PNG works best.
        </p>

        {savedFavicon && (
          <div style={successBannerStyle}>
            Favicon updated - browsers cache these hard, so you may need
            a fresh tab to see it.
          </div>
        )}

        {settings.favicon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.favicon_url}
            alt="Current favicon"
            style={{ width: 32, height: 32, display: "block", marginBottom: 12 }}
          />
        ) : (
          <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            Nothing uploaded - currently showing the built-in PatchUp
            emblem.
          </p>
        )}

        <AppLogoUploadForm uploadEndpoint="/api/admin/upload-favicon" savedParam="favicon" />
      </section>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: "var(--card-pad, 16px)",
  margin: "16px 0",
  border: "1px solid #e2e2e2",
};

const successBannerStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 10,
  borderRadius: 2,
  fontSize: 13,
  marginBottom: 12,
};
