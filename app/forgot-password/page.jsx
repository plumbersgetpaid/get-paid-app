import ForgotPasswordForm from "./ForgotPasswordForm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function ForgotPassword({ searchParams }) {
  const cameFromAccount = searchParams?.from === "account";

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>
        Reset your password
      </h1>
      <p style={{ fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 }}>
        Enter the email on your account and we'll send you a link to
        choose a new password.
      </p>
      <ForgotPasswordForm />
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Link href={cameFromAccount ? "/account" : "/login"} style={{ fontSize: 13, color: "#666" }}>
          {cameFromAccount ? "← Back to my account" : "← Back to login"}
        </Link>
      </div>
    </main>
  );
}
