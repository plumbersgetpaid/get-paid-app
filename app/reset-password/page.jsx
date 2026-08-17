import ResetPasswordForm from "./ResetPasswordForm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function ResetPassword({ searchParams }) {
  const token = searchParams?.token || "";

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 24, textAlign: "center" }}>
        Choose a new password
      </h1>

      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 14,
            borderRadius: 2,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          This link is missing its reset code - use the link from your
          email, or request a new one below.
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Link href="/forgot-password" style={{ fontSize: 13, color: "#666" }}>
          Request a new reset link
        </Link>
      </div>
    </main>
  );
}
