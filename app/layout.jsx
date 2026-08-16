import "./globals.css";
import BottomNav from "./components/BottomNav";
import { getCurrentTeamMember } from "./lib/auth";
import {
  canCreateQuote,
  canCreateJob,
  canCreateRecurringJob,
  canSeeClientDatabase,
} from "./lib/permissions";

export const metadata = {
  title: "Patch Up",
  description: "Never chase an invoice by hand again",
};

export default async function RootLayout({ children }) {
  const currentMember = await getCurrentTeamMember();

  return (
    <html lang="en">
      <body>
        <div className="desktop-wordmark">
          <img src="/icon-white.svg" alt="" height={24} />
          <img src="/wordmark-white.svg" alt="Patch Up" height={24} />
        </div>
        <div className="app-shell" style={{ padding: "16px", paddingBottom: 110 }}>
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
