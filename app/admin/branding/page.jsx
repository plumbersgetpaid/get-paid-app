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
  const saved = searchParams?.saved === "1";

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Platform branding</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8, marginBottom: 16 }}>
        This is the app&apos;s own logo, shown on the login and setup
        screens before anyone&apos;s signed in to a business yet, and as
        a small sign-off at the bottom of the Today page once someone
        is. It&apos;s separate from any individual business&apos;s own
        logo in Business settings, and only visible to platform admins.
      </p>

      {saved && (
        <div style={successBannerStyle}>Logo updated - now live on the login screen.</div>
      )}

      <section style={cardStyle}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>App logo</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 12 }}>
          Shown on the login and setup screens. Best as a PNG with a
          transparent or white background.
        </p>

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

        <AppLogoUploadForm />
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
