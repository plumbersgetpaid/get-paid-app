import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function Login() {
  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24, textAlign: "center" }}>
        Get Paid
      </h1>
      <LoginForm />
    </main>
  );
}
