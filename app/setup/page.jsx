import { supabaseAdmin } from "../lib/supabaseClient";
import { getPlatformSettings } from "../lib/getPlatformSettings";
import { redirect } from "next/navigation";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Setup() {
  const db = supabaseAdmin();
  const { count } = await db
    .from("team_members")
    .select("id", { count: "exact", head: true });

  if (count && count > 0) {
    redirect("/login");
  }

  const settings = await getPlatformSettings();

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        {settings.app_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.app_logo_url}
            alt="Patch Up"
            style={{ maxWidth: "55%", maxHeight: 70 }}
          />
        ) : (
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Patch Up</h1>
        )}
      </div>
      <p style={{ fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 }}>
        Set up your owner account to get started
      </p>
      <SetupForm />
    </main>
  );
}
