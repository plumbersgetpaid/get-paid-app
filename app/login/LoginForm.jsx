import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function Login({ searchParams }) {
  const justReset = searchParams?.reset === "1";

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24, textAlign: "center" }}>
        Get Paid
      </h1>
      {justReset && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Password reset - log in with your new one below.
        </div>
      )}
      <LoginForm />
    </main>
  );
}
