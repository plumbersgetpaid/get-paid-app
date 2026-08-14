import BottomNav from "./components/BottomNav";
import { getCurrentTeamMember } from "./lib/auth";
import { canSeeEverything } from "./lib/permissions";

export const metadata = {
  title: "Get Paid",
  description: "Never chase an invoice by hand again",
};

export default async function RootLayout({ children }) {
  const currentMember = await getCurrentTeamMember();
  const showEverything = canSeeEverything(currentMember);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          background: "#f6f7f9",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px", paddingBottom: 110 }}>
          {children}
        </div>
        <BottomNav showEverything={showEverything} />
      </body>
    </html>
  );
}
