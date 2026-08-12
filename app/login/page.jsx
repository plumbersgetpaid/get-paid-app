import { supabaseAdmin } from "../lib/supabaseClient";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function Login() {
  const db = supabaseAdmin();
  const { count } = await db
    .from("team_members")
    .select("id", { count: "exact", head: true });

  if (!count || count === 0) {
    redirect("/setup");
  }

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24, textAlign: "center" }}>
        Get Paid
      </h1>
      <LoginForm />
    </main>
  );
}
