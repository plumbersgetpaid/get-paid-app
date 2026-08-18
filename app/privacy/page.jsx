import Link from "next/link";

export const metadata = { title: "Privacy Policy - PatchUp" };

// Deliberately written against what the system actually does - the
// deletion job, the export, the signed photo links all exist and are
// verified, so this page states facts rather than intentions. If a
// behaviour changes, change this page in the same pull request.
export default function PrivacyPolicy() {
  return (
    <main style={pageStyle}>
      <h1 style={h1Style}>Privacy Policy</h1>
      <p style={mutedStyle}>Last updated: 18 August 2026</p>

      <h2 style={h2Style}>Who we are</h2>
      <p style={pStyle}>
        PatchUp is a job management app for tradespeople: quotes, scheduling,
        invoicing and payment chasing. It is operated from the United Kingdom.
        Questions about this policy or your data: {" "}
        <a href="mailto:plumbersgetpaid@gmail.com" style={linkStyle}>
          plumbersgetpaid@gmail.com
        </a>.
      </p>

      <h2 style={h2Style}>Two kinds of people use this data</h2>
      <p style={pStyle}>
        <strong>If you have a PatchUp account</strong> (you're a tradesperson
        or on their team), we are the <em>data controller</em> for your account
        details: your name, email address, and how you use the service.
      </p>
      <p style={pStyle}>
        <strong>If you're a customer of a tradesperson</strong> who uses
        PatchUp (for example, they fixed your boiler), your details were
        entered by them, not by you. For that data the tradesperson is the
        controller and we are their <em>data processor</em> - we store and
        handle it only on their instructions. If you want your details
        corrected or removed, ask the tradesperson; we've built them the tools
        to do it, and we'll help if they need it.
      </p>

      <h2 style={h2Style}>What we hold</h2>
      <ul style={ulStyle}>
        <li>Account details: name, email, and a securely hashed password (we cannot see the password itself)</li>
        <li>Business records the tradesperson enters: their customers' names, phone numbers, email addresses and job addresses; quotes, jobs, invoices, payment status and notes</li>
        <li>Job photos, which may show the inside of customers' homes. These are stored privately - each photo is only reachable through a link that expires within an hour, generated for someone logged into that business</li>
        <li>Billing details for the PatchUp subscription itself. Card numbers never touch us - payment is handled entirely by Stripe</li>
      </ul>
      <p style={pStyle}>
        We use one strictly necessary cookie to keep you logged in. No
        advertising or tracking cookies, and no analytics that identify you.
      </p>

      <h2 style={h2Style}>The voice features</h2>
      <p style={pStyle}>
        If you use the voice booking or note-enhancement features, your
        recording is sent to OpenAI to be turned into text, and the text is
        sent to Anthropic to be turned into a structured booking or a tidied
        note. Both process it to provide the feature, not to build profiles.
        If you'd rather nothing you say leaves the app, type instead - every
        voice feature has a typed equivalent.
      </p>

      <h2 style={h2Style}>Who processes data for us</h2>
      <ul style={ulStyle}>
        <li><strong>Supabase</strong> - database and file storage</li>
        <li><strong>Vercel</strong> - hosting</li>
        <li><strong>Stripe</strong> - subscription billing</li>
        <li><strong>Resend</strong> - sends the emails (invoices, reminders, chasers)</li>
        <li><strong>OpenAI</strong> - voice transcription, only when you use a voice feature</li>
        <li><strong>Anthropic</strong> - text structuring, only when you use a voice or AI feature</li>
      </ul>
      <p style={pStyle}>
        Some of these providers process data outside the UK. Where they do,
        the transfer is covered by their standard contractual safeguards.
      </p>

      <h2 style={h2Style}>How long we keep it</h2>
      <p style={pStyle}>
        While an account is active, we keep its data so the service works.
        <strong> Thirty days after an account is cancelled, everything is
        permanently deleted</strong>: customers, jobs, quotes, invoices,
        photos, notes, team members and settings. This happens automatically
        and cannot be reversed.
      </p>
      <p style={pStyle}>
        One exception: the billing record of the subscription itself (what the
        business paid us, when) is kept for six years, because UK tax law
        requires it. It contains no customer data.
      </p>
      <p style={pStyle}>
        Before cancelling, any account owner can download everything - every
        client, job, quote, invoice and photo - as one file, from the Billing
        page. Invoices are the tradesperson's own tax records, so we say this
        loudly there too: export first, cancel second.
      </p>

      <h2 style={h2Style}>Your rights</h2>
      <p style={pStyle}>
        You can ask us for a copy of your data, ask us to correct it, or ask
        us to delete it. Account holders can do most of this directly: the
        export is self-serve, and deleting your account triggers the 30-day
        deletion described above. For anything else, email us - we respond
        within a month, as UK GDPR requires.
      </p>
      <p style={pStyle}>
        If you think we've handled your data badly, you can complain to the
        Information Commissioner's Office at {" "}
        <a href="https://ico.org.uk" style={linkStyle}>ico.org.uk</a>. We'd
        appreciate the chance to fix it first.
      </p>

      <p style={{ ...pStyle, marginTop: 32 }}>
        <Link href="/terms" style={linkStyle}>Terms of Service</Link>
        {" · "}
        <Link href="/login" style={linkStyle}>Back to PatchUp</Link>
      </p>
    </main>
  );
}

const pageStyle = { maxWidth: 640, margin: "0 auto", padding: "40px 20px 80px" };
const h1Style = { fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 4 };
const h2Style = { fontSize: 16, fontWeight: 500, marginTop: 28, marginBottom: 8 };
const pStyle = { fontSize: 14, lineHeight: 1.65, color: "#333", margin: "0 0 12px" };
const ulStyle = { fontSize: 14, lineHeight: 1.65, color: "#333", margin: "0 0 12px", paddingLeft: 22 };
const mutedStyle = { fontSize: 12, color: "#888", marginBottom: 24 };
const linkStyle = { color: "#000" };
