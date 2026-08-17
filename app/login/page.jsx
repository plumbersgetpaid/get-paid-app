import Link from "next/link";
import LoginForm from "./LoginForm";
import { getPlatformSettings } from "../lib/getPlatformSettings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Login() {
  const settings = await getPlatformSettings();

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        {settings.app_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.app_logo_url}
            alt="PatchUp"
            style={{ maxWidth: "60%", maxHeight: 80 }}
          />
        ) : (
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>PatchUp</h1>
        )}
      </div>
      <div style={cardStyle}>
        <LoginForm />
      </div>
      <p style={footerStyle}>
        New here?{" "}
        <Link href="/signup" style={{ color: "#000" }}>
          Start a free trial
        </Link>
      </p>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: 24,
  border: "1px solid #e2e2e2",
};

const footerStyle = {
  textAlign: "center",
  fontSize: 13,
  color: "#6b6b6b",
  marginTop: 20,
};
