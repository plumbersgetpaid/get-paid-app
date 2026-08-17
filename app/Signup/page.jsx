import Link from "next/link";
import SignupForm from "./SignupForm";
import { getPlatformSettings } from "../lib/getPlatformSettings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Signup({ searchParams }) {
  const settings = await getPlatformSettings();

  // The marketing site's pricing calculator passes the team size
  // through, so someone who worked out their price there doesn't have
  // to answer the same question twice.
  const fromMarketing = parseInt((searchParams?.team || "").toString(), 10);
  const initialTeamSize = Number.isFinite(fromMarketing) && fromMarketing > 0 ? fromMarketing : 1;

  return (
    <main style={{ maxWidth: 400, margin: "48px auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        {settings.app_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.app_logo_url}
            alt="PatchUp"
            style={{ maxWidth: "55%", maxHeight: 70 }}
          />
        ) : (
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
            PatchUp
          </h1>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={headingStyle}>Set up your business</h2>
        <p style={subStyle}>Free for 14 days. No card needed.</p>
        <SignupForm initialTeamSize={initialTeamSize} />
      </div>

      <p style={footerStyle}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#000" }}>
          Log in
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

const headingStyle = {
  fontSize: 19,
  fontWeight: 500,
  letterSpacing: "-0.02em",
  margin: "0 0 4px",
};

const subStyle = {
  fontSize: 13,
  color: "#6b6b6b",
  margin: "0 0 22px",
};

const footerStyle = {
  textAlign: "center",
  fontSize: 13,
  color: "#6b6b6b",
  marginTop: 20,
};
