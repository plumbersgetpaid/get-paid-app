import ForgotPasswordForm from "./ForgotPasswordForm";
import BackButton from "../components/BackButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function ForgotPassword({ searchParams }) {
  // This page is reachable two ways: from the logged-out login screen,
  // or from My Account while already logged in (for someone who's
  // forgotten their actual password despite still having a valid
  // session). The back destination needs to match wherever they
  // actually came from - sending a logged-in person to the login screen
  // looks like they've been logged out, even though their session is
  // still fine. Only used as a fallback if there's no history to go
  // back through at all (e.g. landing here directly via a bookmark) -
  // BackButton uses router.back() first, which is what actually avoids
  // the ping-pong loop a plain link caused here: a normal link always
  // pushes a new history entry, so "back to account" from a page you
  // reached _from_ account created two separate account entries with
  // this page sandwiched between them, and the phone's real back button
  // just walked back and forth between that pair instead of leaving.
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
        <BackButton
          fallbackHref={cameFromAccount ? "/account" : "/login"}
          style={backLinkStyle}
        >
          {cameFromAccount ? "← Back to my account" : "← Back to login"}
        </BackButton>
      </div>
    </main>
  );
}

const backLinkStyle = {
  background: "none",
  border: "none",
  fontSize: 13,
  color: "#666",
  cursor: "pointer",
  padding: 0,
};
