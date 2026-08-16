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
          <svg width="24" height="24" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="5" width="80" height="80" rx="40" fill="#f6f7f9" />
            <path
              d="M32 24 L32 66 M32 24 L50 24 A13 13 0 0 1 50 50 L32 50"
              stroke="#d97706"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span>
            Patch<span className="wordmark-accent">Up</span>
          </span>
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
