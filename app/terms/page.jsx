import Link from "next/link";

export const metadata = { title: "Terms of Service - PatchUp" };

export default function TermsOfService() {
  return (
    <main style={pageStyle}>
      <h1 style={h1Style}>Terms of Service</h1>
      <p style={mutedStyle}>Last updated: 18 August 2026</p>

      <p style={pStyle}>
        These are the terms for using PatchUp. They're written in plain
        English on purpose - if anything is unclear, ask before you rely on
        it: {" "}
        <a href="mailto:plumbersgetpaid@gmail.com" style={linkStyle}>
          plumbersgetpaid@gmail.com
        </a>.
      </p>

      <h2 style={h2Style}>What PatchUp is</h2>
      <p style={pStyle}>
        A job management tool for tradespeople: quotes, scheduling,
        invoicing, payment chasing and customer records. It sends emails to
        your customers on your behalf - booking confirmations, invoices,
        payment reminders - based on what you set up.
      </p>

      <h2 style={h2Style}>Your account</h2>
      <ul style={ulStyle}>
        <li>You must give accurate details and keep your password to yourself. What happens under your login is your responsibility, so tell us straight away if you think someone else has access.</li>
        <li>You can add team members and control what each can see and do. Adding someone means you're happy for them to see what you've granted them.</li>
        <li>The trial is 14 days, no card needed. After that it's a paid subscription: a monthly base price plus a per-person price for each additional active team member, both shown on the Billing page before you pay anything.</li>
      </ul>

      <h2 style={h2Style}>Your customers' data</h2>
      <p style={pStyle}>
        The customer details, job records and photos you put into PatchUp are
        yours, and legally you are their data controller - we process them on
        your instructions (see the {" "}
        <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>). That
        means it's your responsibility to have a lawful basis for what you
        enter: don't photograph more of someone's home than the job needs,
        and if a customer asks you to correct or delete their details, do it.
        The tools are there.
      </p>

      <h2 style={h2Style}>Paying, cancelling, and what happens after</h2>
      <ul style={ulStyle}>
        <li>Billing is monthly through Stripe. If a payment fails we'll retry and email you; if it keeps failing your account may be suspended until it's sorted.</li>
        <li>Cancel whenever you like from the Billing page - no notice period, no exit fee. You keep access until the end of the period you've paid for.</li>
        <li><strong>Thirty days after cancellation, everything in your account is permanently deleted.</strong> Clients, jobs, quotes, invoices, photos, notes - all of it, irreversibly. Download your records first using the export on the Billing page. Your invoices are your own tax documents and HMRC expects you to keep them for six years - that duty is yours, and the export exists so you can meet it.</li>
      </ul>

      <h2 style={h2Style}>What you can't use PatchUp for</h2>
      <ul style={ulStyle}>
        <li>Anything unlawful, including harassing people with payment chasers for money that isn't owed</li>
        <li>Sending spam - the email features exist for genuine customers of your business</li>
        <li>Trying to access other businesses' data or probe the service's security (if you find a hole, email us - we'll thank you, not sue you)</li>
        <li>Reselling access without our agreement</li>
      </ul>

      <h2 style={h2Style}>What we promise, and what we don't</h2>
      <p style={pStyle}>
        We work to keep PatchUp available, fast and correct, and we take the
        safety of your data seriously. But we're a software tool, not your
        accountant or your lawyer: <strong>you're responsible for checking
        that your invoices, prices and tax handling are right</strong> before
        they go to customers. We don't guarantee uninterrupted service, and
        planned maintenance or a fault may occasionally make it unavailable.
      </p>
      <p style={pStyle}>
        If something we get wrong causes you loss, our total liability is
        capped at what you've paid us in the twelve months before the problem.
        Nothing in these terms limits liability that can't legally be limited,
        like liability for fraud, or death or personal injury caused by
        negligence.
      </p>

      <h2 style={h2Style}>Ending an account our side</h2>
      <p style={pStyle}>
        We can suspend or close an account that breaks these terms or doesn't
        pay, and we'll say why. The 30-day deletion clock and your right to
        export apply the same way they do when you cancel yourself.
      </p>

      <h2 style={h2Style}>Changes and the law</h2>
      <p style={pStyle}>
        If we change these terms in a way that matters, we'll tell you by
        email before it takes effect - carrying on using PatchUp after that
        means you accept the change. These terms are governed by the law of
        England and Wales, and disputes belong to its courts.
      </p>

      <p style={{ ...pStyle, marginTop: 32 }}>
        <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>
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
