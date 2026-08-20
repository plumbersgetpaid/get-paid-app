import { getCurrentTeamMember } from "../lib/auth";
import { redirect } from "next/navigation";
import BackButton from "../components/BackButton";
import AskPatchUp from "./AskPatchUp";

export const metadata = { title: "Help - PatchUp" };
export const dynamic = "force-dynamic";

// The in-app help/support screen. Reachable by every role (linked from both
// Settings and My account), so subcontractors can get help too - it's a
// settings-style page, not a floating pop-up.
export default async function HelpPage() {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    redirect("/login");
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/account" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Help</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        Ask a question about how PatchUp works and get an instant answer. For
        billing, your account, or anything not working, email{" "}
        <a href="mailto:hello@getpatchup.co.uk" style={{ color: "#000" }}>
          hello@getpatchup.co.uk
        </a>
        .
      </p>

      <AskPatchUp />
    </main>
  );
}
