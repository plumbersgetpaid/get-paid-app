import BottomNav from "./components/BottomNav";
import { getCurrentTeamMember } from "./lib/auth";
import { poppins, mono, c } from "./lib/theme";
import {
  canCreateQuote,
  canCreateJob,
  canCreateRecurringJob,
  canSeeClientDatabase,
} from "./lib/permissions";

export const metadata = {
  title: "PatchUp",
  description: "Never chase an invoice by hand again",
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
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px", paddingBottom: 110 }}>
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
