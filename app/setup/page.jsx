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
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <svg
          width="56"
          height="56"
          viewBox="0 0 90 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ marginBottom: 8 }}
        >
          <rect x="5" y="5" width="80" height="80" rx="40" fill="#111111" />
          <path
            d="M32 24 L32 66 M32 24 L50 24 A13 13 0 0 1 50 50 L32 50"
            stroke="#d97706"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 800 }}>
          Patch<span style={{ color: "#d97706" }}>Up</span>
        </h1>
      </div>
      <p style={{ fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 }}>
        Set up your owner account to get started
      </p>
      <SetupForm />
    </main>
  );
}
