import Link from "next/link";

export const metadata = { title: "Privacy Policy - PatchUp" };

// Deliberately written against what the system actually does - the
// deletion job, the export, the signed photo links all exist and are
// verified, so this page states facts rather than intentions. If a
// behaviour changes, change this page in the same pull request.
//
// NOTE (sole-trader stage): controller is currently "Blaise" (first name only,
// fine for the friends-and-family stage where users know him). Before any
// PUBLIC launch this needs a full, identifiable trader identity AND a contact
// address — the clean way to get both without exposing a home address is to
// incorporate: swap this wording for the limited company's name, number and
// registered office (the plan once PatchUp goes beyond people he knows).
export default function PrivacyPolicy() {
  return (
    <main style={pageStyle}>
      <h1 style={h1Style}>Privacy Policy</h1>
      <p style={mutedStyle}>Last updated: 20 August 2026</p>

      <h2 style={h2Style}>Who we are</h2>
      <p style={pStyle}>
        PatchUp is a job management app for tradespeople: quotes, scheduling,
        invoicing and payment chasing. It is operated by{" "}
        <strong>Blaise</strong>, a sole trader trading as PatchUp, based in the
        United Kingdom. For anything about this policy or your data, contact{" "}
        <a href="mailto:hello@getpatchup.co.uk" style={linkStyle}>
          hello@getpatchup.co.uk
        </a>. Where this policy says &quot;we&quot; as the controller, it means
        that sole trader.
      </p>

      <h2 style={h2Style}>Two kinds of people use this data</h2>
      <p style={pStyle}>
        <strong>If you have a PatchUp account</strong> (you&apos;re a tradesperson
        or on their team), we are the <em>data controller</em> for your account
        details: your name, email address, and how you use the service.
      </p>
      <p style={pStyle}>
        <strong>If you&apos;re a customer of a tradesperson</strong> who uses
        PatchUp (for example, they fixed your boiler), your details were
        entered by them, not by you. For that data the tradesperson is the
        controller and we are their <em>data processor</em> - we store and
        handle it only on their instructions. If you want your details
        corrected or removed, ask the tradesperson; we&apos;ve built them the tools
        to do it, and we&apos;ll help if they need it.
      </p>

      <h2 style={h2Style}>What we hold</h2>
      <ul style={ulStyle}>
        <li>Account details: name, email, and a securely hashed password (we cannot see the password itself)</li>
        <li>Business records the tradesperson enters: their customers&apos; names, phone numbers, email addresses and job addresses; quotes, jobs, invoices, payment status and notes</li>
        <li>Job photos, which may show the inside of customers&apos; homes. These are stored privately - each photo is only reachable through a link that expires within an hour, generated for someone logged into that business</li>
        <li>Billing details for the PatchUp subscription itself. Card numbers never touch us - payment is handled entirely by Stripe</li>
        <li>A limited amount of technical data needed to run and secure the service: your IP address is recorded briefly when you sign in or reset a password, to stop password-guessing attacks. Those records are automatically deleted within 24 hours</li>
        <li>If you turn on notifications, the details your browser or device needs to receive them (a push &quot;endpoint&quot;), until you turn them off or the device unsubscribes</li>
      </ul>
      <p style={pStyle}>
        We use one strictly necessary cookie to keep you logged in. No
        advertising or tracking cookies, and no analytics that identify you.
      </p>

      <h2 style={h2Style}>Why we&apos;re allowed to hold it (lawful bases)</h2>
      <p style={pStyle}>
        Under UK GDPR we rely on:
      </p>
      <ul style={ulStyle}>
        <li><strong>Contract</strong> - to give you the service you signed up for: your account, your data, the emails PatchUp sends for you.</li>
        <li><strong>Legitimate interests</strong> - to keep the service secure (the brief IP records above), to fix problems, and to run the business. We&apos;ve weighed these against your privacy and kept the data to the minimum.</li>
        <li><strong>Legal obligation</strong> - to keep the subscription billing record for six years for UK tax.</li>
        <li><strong>Consent</strong> - for the optional voice features and for push notifications. You can withdraw either at any time (type instead of speaking; turn notifications off) without losing the rest of the service.</li>
      </ul>
      <p style={pStyle}>
        For the homeowner data a tradesperson enters, the <em>tradesperson</em>
        chooses the lawful basis - we only process it on their instructions.
      </p>

      <h2 style={h2Style}>The voice features</h2>
      <p style={pStyle}>
        If you use the voice booking or note-enhancement features, your
        recording is sent to OpenAI to be turned into text, and the text is
        sent to Anthropic to be turned into a structured booking or a tidied
        note. Both process it to provide the feature, not to build profiles.
        If you&apos;d rather nothing you say leaves the app, type instead - every
        voice feature has a typed equivalent.
      </p>

      <h2 style={h2Style}>Who processes data for us (sub-processors)</h2>
      <ul style={ulStyle}>
        <li><strong>Supabase</strong> - database and file storage (hosted in the EU)</li>
        <li><strong>Vercel</strong> - hosting and delivery (served from the London region)</li>
        <li><strong>Stripe</strong> - subscription billing</li>
        <li><strong>Resend</strong> - sends the emails (invoices, reminders, chasers)</li>
        <li><strong>OpenAI</strong> - voice transcription, only when you use a voice feature</li>
        <li><strong>Anthropic</strong> - text structuring, only when you use a voice or AI feature</li>
        <li>Your notifications are delivered by your own browser or device&apos;s push service (for example Apple, Google, Microsoft or Mozilla) - that&apos;s how web push works, and it&apos;s outside our control once sent</li>
      </ul>
      <p style={pStyle}>
        This is the current list. If we add or change a sub-processor, we&apos;ll
        update this page.
      </p>

      <h2 style={h2Style}>Where your data is stored, and transfers abroad</h2>
      <p style={pStyle}>
        Your core data - your account, your customers, jobs, invoices and
        photos - is stored in the <strong>European Union</strong>, and the app
        runs from the London region next to it. Some of the providers above
        (for example Stripe, Resend, OpenAI and Anthropic) may process data in
        the United States. Where data leaves the UK, the transfer is protected
        by the UK&apos;s <strong>International Data Transfer Agreement (or the EU
        Standard Contractual Clauses with the UK Addendum)</strong> in our
        contracts with those providers.
      </p>

      <h2 style={h2Style}>Data stored on your device</h2>
      <p style={pStyle}>
        So the app still works where there&apos;s no signal, your phone keeps a
        small offline copy of your next 7 days: your own jobs with customer
        names, phone numbers and addresses, plus job notes. Work you record
        while offline (job completions, notes, photos) is also held on the
        phone until it can be sent. This all lives on your device only,
        refreshes automatically, and is deleted when you log out - so don&apos;t
        stay logged in on a phone that isn&apos;t yours.
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
        client, job, quote, invoice, note and photo - as one file, from the
        Billing page. Any download links inside that file for large photos
        expire after 7 days, so save what you need promptly. Invoices are the
        tradesperson&apos;s own tax records, so we say this loudly there too:
        export first, cancel second.
      </p>

      <h2 style={h2Style}>Keeping it safe, and telling you if something goes wrong</h2>
      <p style={pStyle}>
        We take security seriously: passwords are hashed, photos are private
        and reachable only through short-lived links, each business&apos;s data is
        isolated from every other, and card details never reach us. If a
        breach ever puts your rights at risk, we&apos;ll report it to the
        Information Commissioner&apos;s Office within 72 hours of becoming aware,
        and tell affected people without undue delay.
      </p>

      <h2 style={h2Style}>Your rights</h2>
      <p style={pStyle}>
        Under UK GDPR you can ask us to give you a copy of your data
        (access and portability), correct it, delete it, restrict how we use
        it, or object to a particular use. Where we rely on your consent (voice,
        notifications) you can withdraw it at any time. Account holders can do
        most of this directly: the export is self-serve, and deleting your
        account triggers the 30-day deletion described above. For anything else,
        email us - we respond within a month, as UK GDPR requires, and we don&apos;t
        charge for it.
      </p>
      <p style={pStyle}>
        If you think we&apos;ve handled your data badly, you can complain to the
        Information Commissioner&apos;s Office at {" "}
        <a href="https://ico.org.uk" style={linkStyle}>ico.org.uk</a>. We&apos;d
        appreciate the chance to fix it first.
      </p>

      <p style={{ ...pStyle, marginTop: 32 }}>
        <Link href="/terms" style={linkStyle}>Terms of Service</Link>
        {" · "}
        <a href="https://getpatchup.co.uk" style={linkStyle}>getpatchup.co.uk</a>
        {" · "}
        <Link href="/login" style={linkStyle}>Log in</Link>
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
