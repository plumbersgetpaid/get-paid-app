import BottomNav from "./components/BottomNav";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import InstallBanner from "./components/InstallBanner";
import FieldPackSync from "./components/FieldPackSync";
import { getCurrentTeamMember } from "./lib/auth";
import { getPlatformSettings } from "./lib/getPlatformSettings";
import { poppins, mono, c } from "./lib/theme";
import {
  canCreateQuote,
  canCreateJob,
  canCreateRecurringJob,
  canSeeClientDatabase,
} from "./lib/permissions";

const responsiveCss = `
  :root {
    --page-max: 480px;
    --page-pad: 16px;
    --card-pad: 16px;
    --card-pad-tight: 14px;
    --card-gap: 14px;
  }

  /* Desktop. The column widens but stays a column - the shape of every
     screen is unchanged, there's just more room in it. */
  @media (min-width: 900px) {
    :root {
      --page-max: 840px;
      --page-pad: 24px;
      --card-pad: 22px;
      --card-pad-tight: 18px;
      --card-gap: 18px;
    }
  }
`;

// generateMetadata rather than a static `metadata` object so the browser
// tab icon can be swapped from Platform branding without a code change.
// Falls back to the emblem bundled in /public when nothing is uploaded.
export async function generateMetadata() {
  const platformSettings = await getPlatformSettings();
  return {
    title: "PatchUp",
    description: "Never chase an invoice by hand again",
    // SVG first so it stays crisp on any display, PNG behind it for
    // browsers that don't take an SVG favicon. An uploaded one wins over
    // both.
    icons: {
      icon: platformSettings.favicon_url
        ? [{ url: platformSettings.favicon_url }]
        : [
            { url: "/patchup-emblem.svg", type: "image/svg+xml" },
            { url: "/patchup-emblem.png", type: "image/png" },
          ],
      // iOS uses this for the home-screen icon when installed as a PWA.
      apple: [{ url: "/apple-touch-icon.png" }],
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "PatchUp",
      statusBarStyle: "default",
    },
  };
}

// Drives the browser/status-bar tint on the installed app.
export const viewport = {
  themeColor: "#111111",
  // Required for env(safe-area-inset-*) to report real values on iPhones
  // with a home indicator - without it the insets are always 0 and the
  // bottom nav sits under the indicator.
  viewportFit: "cover",
};

export default async function RootLayout({ children }) {
  const currentMember = await getCurrentTeamMember();

  return (
    // Both font variables are attached at the root so any screen can
    // reach for the mono face via var(--font-mono) without importing
    // anything - figures are set in it all over the app.
    <html lang="en" className={`${poppins.variable} ${mono.variable}`}>
      <body
        style={{
          fontFamily: "var(--font-poppins), system-ui, sans-serif",
          margin: 0,
          background: c.surface,
          color: c.ink,
          WebkitFontSmoothing: "antialiased",
          // Stops the iOS rubber-band bounce, which is what made the fixed
          // bottom nav appear to jitter when scrolling past the ends.
          overscrollBehavior: "none",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: responsiveCss }} />
        <div
          style={{
            maxWidth: "var(--page-max)",
            margin: "0 auto",
            padding: "var(--page-pad)",
            paddingBottom: 110,
          }}
        >
          {children}
        </div>
        <BottomNav
          canCreateQuote={canCreateQuote(currentMember)}
          canCreateJob={canCreateJob(currentMember)}
          canCreateRecurringJob={canCreateRecurringJob(currentMember)}
          canSeeClientDatabase={canSeeClientDatabase(currentMember)}
        />
        <ServiceWorkerRegister />
        {currentMember && <InstallBanner />}
        {currentMember && <FieldPackSync />}
      </body>
    </html>
  );
}
