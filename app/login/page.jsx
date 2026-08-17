import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function Login() {
  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img src="/04-logo-on-white-1254.png" alt="Patch Up" width={160} style={{ maxWidth: "60%" }} />
      </div>
      <LoginForm />
    </main>
  );
}
