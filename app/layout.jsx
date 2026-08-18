import BottomNav from "./components/BottomNav";
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
    icons: { icon: platformSettings.favicon_url || "/patchup-emblem.png" },
  };
}

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
      </body>
    </html>
  );
}
