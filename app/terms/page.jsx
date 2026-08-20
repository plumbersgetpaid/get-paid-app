import Link from "next/link";

export const metadata = { title: "Terms of Service - PatchUp" };

// NOTE (sole-trader stage): provider is currently "Blaise" (first name only,
// fine while users are friends and family). Before a PUBLIC launch, swap for
// the limited company's name/number/registered office once PatchUp
// incorporates (that also supplies the required contact address without
// exposing a home address). The "Our role as your data processor" section is a
// plain-English Article 28 processor commitment; have a solicitor review it
// before scaling to paying customers outside your own circle.
export default function TermsOfService() {
  return (
    <main style={pageStyle}>
      <h1 style={h1Style}>Terms of Service</h1>
      <p style={mutedStyle}>Last updated: 20 August 2026</p>

      <p style={pStyle}>
        These are the terms for using PatchUp, operated by{" "}
        <strong>Blaise</strong>, a sole trader trading as PatchUp, United
        Kingdom. They&apos;re written in plain English on purpose - if anything
        is unclear, ask before you rely on it: {" "}
        <a href="mailto:hello@getpatchup.co.uk" style={linkStyle}>
          hello@getpatchup.co.uk
        </a>.
      </p>

      <h2 style={h2Style}>What PatchUp is</h2>
      <p style={pStyle}>
        A job management tool for tradespeople: quotes, scheduling,
        invoicing, payment chasing and customer records. It sends emails to
        your customers on your behalf - booking confirmations, invoices,
        payment reminders - based on what you set up.
      </p>

      <h2 style={h2Style}>Who can use it</h2>
      <p style={pStyle}>
        PatchUp is for business use by people aged 18 or over, running or
        working for a trade. It isn&apos;t a consumer product - by signing up you
        confirm you&apos;re using it for your business.
      </p>

      <h2 style={h2Style}>Your account</h2>
      <ul style={ulStyle}>
        <li>You must give accurate details and keep your password to yourself. What happens under your login is your responsibility, so tell us straight away if you think someone else has access.</li>
        <li>You can add team members and control what each can see and do. Adding someone means you&apos;re happy for them to see what you&apos;ve granted them.</li>
        <li>The trial is 14 days, no card needed. After that it&apos;s a paid subscription: a monthly base price plus a per-person price for each additional active team member, both shown on the Billing page before you pay anything.</li>
      </ul>

      <h2 style={h2Style}>Paying, prices, and refunds</h2>
      <ul style={ulStyle}>
        <li>Billing is monthly through Stripe. If a payment fails we&apos;ll retry over a few days and email you; if it keeps failing your account may be suspended, and if it stays unpaid the subscription is cancelled - which starts the 30-day deletion clock below.</li>
        <li>Cancel whenever you like from the Billing page - no notice period, no exit fee. You keep access until the end of the period you&apos;ve already paid for.</li>
        <li><strong>We don&apos;t give partial refunds.</strong> When you cancel you keep access to the end of the paid month and aren&apos;t charged again; we don&apos;t refund the unused part of a month. Nothing here affects rights you have under UK consumer law that can&apos;t be excluded.</li>
        <li><strong>Price changes:</strong> if we change the subscription price, we&apos;ll email you at least 30 days before it takes effect. If you don&apos;t want the new price, cancel before it starts.</li>
      </ul>

      <h2 style={h2Style}>Your customers&apos; data, and our role</h2>
      <p style={pStyle}>
        The customer details, job records and photos you put into PatchUp are
        yours, and legally you are their data controller - we process them on
        your instructions (see the {" "}
        <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>). That
        means it&apos;s your responsibility to have a lawful basis for what you
        enter: don&apos;t photograph more of someone&apos;s home than the job needs,
        and if a customer asks you to correct or delete their details, do it.
        The tools are there.
      </p>

      <h2 style={h2Style}>Our role as your data processor</h2>
      <p style={pStyle}>
        For that customer data, you are the controller and we are your
        processor. This section sets out how we act on your behalf (UK GDPR
        Article 28). While you use PatchUp, we will:
      </p>
      <ul style={ulStyle}>
        <li>process that data only to provide PatchUp and only on your instructions (using the app is how you give them);</li>
        <li>keep it confidential and make sure the people who can access it are bound to do the same;</li>
        <li>protect it with appropriate security - the measures described in the Privacy Policy;</li>
        <li>use only the sub-processors listed in the Privacy Policy, and tell you before adding a new one so you can object;</li>
        <li>help you respond to your customers&apos; data requests, and to complaints or breaches, using the export and deletion tools built into the app;</li>
        <li>delete it 30 days after you cancel (the export lets you take it first);</li>
        <li>make available the information you reasonably need to show this is being done.</li>
      </ul>
      <p style={pStyle}>
        If you need a separate signed data processing agreement for your own
        compliance, email us and we&apos;ll sort one out.
      </p>

      <h2 style={h2Style}>What happens to your data after you cancel</h2>
      <p style={pStyle}>
        <strong>Thirty days after cancellation, everything in your account is
        permanently deleted</strong> - clients, jobs, quotes, invoices, photos,
        notes, all of it, irreversibly. Download your records first using the
        export on the Billing page. Your invoices are your own tax documents and
        HMRC expects you to keep them for six years - that duty is yours, and
        the export exists so you can meet it.
      </p>

      <h2 style={h2Style}>Who owns what</h2>
      <p style={pStyle}>
        You own the data you put in. We own PatchUp itself - the software, the
        design and the PatchUp name and brand - and using the service doesn&apos;t
        transfer any of that to you. You give us permission to host and process
        your data only as far as we need to in order to run the service for you.
      </p>

      <h2 style={h2Style}>What you can&apos;t use PatchUp for</h2>
      <ul style={ulStyle}>
        <li>Anything unlawful, including harassing people with payment chasers for money that isn&apos;t owed</li>
        <li>Sending spam - the email features are for genuine customers of your own business, and we may rate-limit or suspend sending we reasonably believe is being abused</li>
        <li>Trying to access other businesses&apos; data or probe the service&apos;s security (if you find a hole, email us - we&apos;ll thank you, not sue you)</li>
        <li>Reselling access without our agreement</li>
      </ul>
      <p style={pStyle}>
        Because PatchUp sends email in your name, you&apos;re responsible for what&apos;s
        sent from your account. If your use causes a third-party claim against
        us - for example spam complaints, or a customer&apos;s data you had no right
        to enter - you agree to cover the reasonable costs we face as a result.
      </p>

      <h2 style={h2Style}>What we promise, and what we don&apos;t</h2>
      <p style={pStyle}>
        We work to keep PatchUp available, fast and correct, and we take the
        safety of your data seriously. But we&apos;re a software tool, not your
        accountant or your lawyer: <strong>you&apos;re responsible for checking
        that your invoices, prices and tax handling are right</strong> before
        they go to customers. Some features use AI (the voice and note tools) -
        it&apos;s helpful but not perfect, so check what it produces before you send
        it. We don&apos;t guarantee uninterrupted service, features may change or be
        withdrawn as the product develops, and planned maintenance or a fault
        may occasionally make it unavailable.
      </p>
      <p style={pStyle}>
        If something we get wrong causes you loss, our total liability is
        capped at what you&apos;ve paid us in the twelve months before the problem.
        We aren&apos;t liable for indirect or consequential losses, or for lost
        profits. Nothing in these terms limits liability that can&apos;t legally be
        limited, like liability for fraud, or death or personal injury caused by
        negligence.
      </p>

      <h2 style={h2Style}>Ending an account our side</h2>
      <p style={pStyle}>
        We can suspend or close an account that breaks these terms or doesn&apos;t
        pay, and we&apos;ll say why. The 30-day deletion clock and your right to
        export apply the same way they do when you cancel yourself.
      </p>

      <h2 style={h2Style}>Changes and the law</h2>
      <p style={pStyle}>
        If we change these terms in a way that matters, we&apos;ll tell you by
        email before it takes effect - carrying on using PatchUp after that
        means you accept the change. These terms are governed by the law of
        England and Wales, and disputes belong to its courts.
      </p>

      <p style={{ ...pStyle, marginTop: 32 }}>
        <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>
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
