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
            alt="Patch Up"
            style={{ maxWidth: "60%", maxHeight: 80 }}
          />
        ) : (
          <h1 style={{ fontSize: 22, margin: 0 }}>Patch Up</h1>
        )}
      </div>
      <div style={cardStyle}>
        <LoginForm />
      </div>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
  border: "1px solid #eee",
};
