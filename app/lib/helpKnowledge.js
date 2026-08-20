// The knowledge the in-app help assistant ("Ask PatchUp") answers from.
//
// This is the single source of truth the AI is allowed to use. It is kept
// deliberately factual and complete for how-to questions. If a feature
// changes, update this string in the same change — the assistant must never
// describe behaviour that isn't real. Mirrors docs/app-guide.md.
export const PATCHUP_GUIDE = `
PatchUp is a job-management app for UK tradespeople. Core loop:
quote -> customer accepts -> book the job in -> complete it (photos + notes)
-> an invoice is created and emailed automatically -> chase until paid.

TWO USER TYPES
- Owner / Manager: sees everything - money, all jobs, all clients, settings,
  billing. (Owner is a manager who also can't be demoted or removed.)
- Subcontractor: sees only jobs assigned to or shared with them. No money, no
  client list, no settings - unless the owner switches on specific permissions.

SUBCONTRACTOR PERMISSIONS (owner sets these under Settings > Team > the
person's "Permissions"; all start OFF):
- Can invoice (mark jobs done, send invoices, use the Invoices section)
- Can see the client database
- Can create new quotes
- Can quick-book new jobs
- Can manage recurring jobs
- Can reschedule jobs

GETTING AROUND
- Bottom bar: Today, Work, Calendar, Clients (Clients only shows if you can see
  the client database).
- The round "+" button in the middle creates: New quote, Quick book a job,
  Personal reminder, or Recurring job (each shown only if you're allowed it).
- Install PatchUp to your home screen from the "Install" banner (on iPhone: tap
  the Share button in Safari, then "Add to Home Screen").

SIGN UP / TRIAL / LOGIN
- 14-day free trial, no card needed. Pricing after: £19/month for one person,
  plus £8/month for each extra team member.
- Forgot your password: on the login screen tap "Forgot password?", enter your
  email, and follow the reset link that's emailed to you.

CREATE A QUOTE (the + button > New quote, or needs the quote permission)
- Enter customer name (phone/email optional), job type, quoted amount, and
  optionally a location and a proposed date. You can speak the details with the
  microphone instead of typing, and use the wand button to tidy the wording.
- Tap "Send quote" - a confirmation first shows the customer, job, quote total
  and where it will be emailed; tap "Confirm & send quote" and the customer is
  emailed the quote and it appears under Work > Quotes.

WHEN A CUSTOMER REPLIES (Work > Quotes)
- Accept quote: moves it into your jobs. If you set a proposed date it's already
  booked; otherwise book it in next.
- Chase quote: sends the customer a friendly follow-up email.
- Decline / lost job: marks the quote as lost.

BOOK A JOB IN (from an accepted quote, needs the reschedule permission)
- Set the start date, time and expected duration, optionally tell the client by
  email. If it clashes with another job you'll get a warning and can "Book
  anyway". You can also book by voice.
- Quick book: book a job on the spot with no quote first (the + button > Quick
  book) - handy when you're standing with the customer.
- Quick book and recurring jobs show the same review card before saving as
  quotes do - customer, price, date, and importantly whether the customer will
  be emailed. If you untick "Email" or leave the email blank, the card warns
  you in amber that the customer won't be notified - tap "Go back" to change
  it.

COMPLETE A JOB / GET THE INVOICE OUT (Mark done, needs the invoice permission)
- Open the job and tap "Mark done". You can adjust the final amount, set the
  payment due date (defaults to 14 days), add a payment link, write a completion
  note (with an AI tidy-up button), and attach Before/After photos.
- Tap "Mark done & send invoice": a confirmation first shows you the invoice
  total, who it will be emailed to, and any photos - tap "Confirm & send
  invoice" and the job is completed and the invoice PDF (with your logo and
  any photos) is emailed to the customer automatically. Sending can't be
  undone, which is why the confirmation shows you the details first.
- No signal? It saves on your phone and sends itself when you're back online.

CANCELLING vs DELETING A JOB (from View job, owner/manager): a job with no
invoice can be deleted outright. Once a job has an invoice it can only be
CANCELLED - the invoice stays on record (full history, exports), but if it's
unpaid PatchUp stops the automatic payment reminders and it no longer counts
in the money you're owed. There's no undo for completing a job - if one was
completed by mistake, cancel it.

GET PAID (Work > Invoices)
- Each unpaid invoice has "Chase now" (emails the customer the chaser with the
  PDF) and "Mark as paid".
- PatchUp also chases overdue invoices automatically at 3, 7 and 14 days
  overdue, in wording you set under Settings > Message templates.

TODAY (home): today's schedule, an "Action needed" to-do list, and (owner/
manager) an outstanding-payments total.

WORK: four tabs - Quotes, Jobs, Invoices, Reminders.

CALENDAR: Today/Week/Month views of jobs, payment due dates, reminders and
upcoming recurring jobs. Colours: blue = job (red if overdue), red = payment
due, purple = personal reminder, gold = recurring job.

JOB NOTES & PHOTOS (from a job): notes are internal to your team and never
shown to the customer; mark a note "Important" to flag it. Photos can be Before
or After. Both work offline.

CHECKING AN EMAIL WENT: emails are sent for you from PatchUp's own address
(replies go to your email), so they won't appear in your personal Sent folder.
To see what's actually been sent, open the job (View job) and look at the
"Emails sent to the customer" section - it lists every email for that job
(quote, booking confirmation, invoice, follow-ups, payment reminders, review
request) with the date and time it went out. Quotes also show "Sent X days
ago" on the Work > Quotes tab, and invoices record their sent date.

RECURRING JOBS (needs the recurring permission): set up repeating work (services,
quarterly checks). It books itself onto the calendar on the schedule you choose.

CLIENTS (needs the client-database permission): your customer list. Clients are
created automatically when you quote or book them. PatchUp flags possible
duplicate clients and lets you merge them.

INVOICES SECTION (needs the invoice permission): full invoice history, a custom
date range, totals, and downloads as PDF or CSV (for your accountant/QuickBooks).

TEAM (Settings > Team, owner/manager): add people with a name, email, role and a
starter password you share with them; set each person's role and permissions;
deactivate or delete people.

MESSAGE TEMPLATES (Settings > Message templates, owner/manager): edit the wording
of every automatic email - quote, invoice, chasers, booking confirmation, review
request.

BUSINESS SETTINGS (Settings, owner/manager): business name, tagline, contact
email/phone, accent colour, currency, Google review link, payment terms, bank
details, invoice footer, and your logo.

VAT (Settings, owner/manager): if your business is VAT registered, turn on
"VAT registered" in Settings and enter your VAT number and rate (standard UK
rate is 20%). Then choose how you type prices under "When you type a price":
- "It's the total the customer pays" (the default) - for quoting homeowners a
  single all-in price.
- "It's before VAT - add VAT on top for me" - for commercial-style "£500 +
  VAT" quoting: type 500 and PatchUp automatically sends the quote and
  invoice as 600. Price fields then say "before VAT" and show the total that
  will be charged.
Either way, invoices show a Net / VAT / Total breakdown and your VAT number,
quote emails say the price includes VAT, and the accountant CSV gets net and
VAT columns. Each invoice keeps the rate it was issued with, so old invoices
never change. If you're not VAT registered, leave it all off and nothing
changes.

BILLING (Settings > Billing, owner/manager): your plan and status; "Set up
payment" / "Manage billing" open Stripe (card details never touch PatchUp);
"Download everything" gives you a single zip of all your data. Cancelling is done
inside the Stripe portal. Note: 30 days after you cancel, all your data is
permanently deleted - so export first.

YOUR ACCOUNT (My account, everyone): change your name, email and password, turn
notifications on for this device, and log out.

NOTIFICATIONS: a daily brief email (tomorrow's jobs, invoices due, quotes to
chase), plus optional push notifications about an hour before each job (turn on
under My account; on iPhone the app must be installed to the home screen first).

VOICE & AI: on the New quote, Quick book, Schedule and New reminder screens you
can tap the microphone and speak instead of typing. A wand button tidies typed
notes. Everything has a typed alternative.
`;
