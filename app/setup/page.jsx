import { supabaseAdmin } from "../lib/supabaseClient";
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

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <img src="/logo-black.svg" alt="Patch Up" width={140} style={{ maxWidth: "55%" }} />
      </div>
      <p style={{ fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 }}>
        Set up your owner account to get started
      </p>
      <SetupForm />
    </main>
  );
}
