# PatchUp — Complete App Guide (A to Z)

**What this document is:** a full, plain-English walkthrough of every screen and
feature in PatchUp, in the order a real tradesperson uses them. It's written so
that someone who has **never seen the app** — for example a video editor making a
walkthrough — can follow it start to finish and understand exactly what to show,
what to tap, and what happens as a result.

**How to read it (for a filmmaker):** each screen is written as a little scene:
- **What it's for** — one line of context.
- **On screen** — what the viewer sees.
- **To do it** — the taps, in order.
- **What happens** — the result to show next.

Last updated: 20 August 2026.

---

## 0. The big picture — what PatchUp does

PatchUp is a job-management app for UK tradespeople (plumbers, electricians,
builders, and so on). It runs on your phone and handles everything between
winning a job and getting paid for it. The whole product is built around one
loop:

> **Quote → Customer accepts → Book the job in → Do it and mark it done
> (with photos) → Invoice goes out automatically → Chase it until it's paid.**

Everything else in the app (clients, calendar, team, settings) supports that
loop. If you film nothing else, film that loop — it's Sections 4.1 to 4.8.

**The one-line mental model to open a video with:** "You finish the job.
PatchUp handles getting paid."

---

## 1. Two kinds of user (this changes what's on screen)

Before filming anything, understand this, because the app looks different
depending on who's logged in:

- **Owner / Manager** — the boss. Sees **everything**: money, all jobs, all
  clients, invoices, settings, billing. When you film "the full app," film as an
  owner. (Owner and Manager are almost identical; the only difference is an
  owner can't be demoted or removed.)
- **Subcontractor** ("your lads") — sees **only the jobs assigned to them**. No
  money, no client list, no settings. The owner can switch on up to six extra
  abilities for them one at a time (see Section 12). Film a subcontractor's view
  when you want to show the stripped-back "just my jobs" experience.

Throughout this guide, anything marked **(owner/manager only)** is hidden for a
plain subcontractor.

---

## 2. Getting in — signup, trial, and login

### 2.1 Sign up for a free trial — `/signup`
**What it's for:** a new tradesperson starting their 14-day free trial.
**On screen:** the PatchUp logo, heading **"Set up your business,"** and the line
**"Free for 14 days. No card needed."** Then a form:
- **Business name** (hint: "This goes on your quotes and invoices," e.g.
  "Wilkinson Plumbing")
- **Your name**, **Email**, **Password** (min 8 characters), **Confirm password**
- **"How many of you are there?"** — a row of number pills (1, 2, 3, 4, 5, 6, 8,
  10) plus a box to type a number. Underneath, a live price: **"£X a month after
  your trial · change it any time."**

**To do it:** fill the fields → tap **"Start 14-day free trial."**
**What happens:** the account is created and you land on the **Today** screen (the
home dashboard). No card is asked for.

> **Pricing to show:** £19 a month covers one person; every extra person is £8.
> So a two-person firm is £27, three people £35, and so on.

### 2.2 First-run owner setup — `/setup`
**What it's for:** a one-time screen to create the very first (owner) account.
Once any account exists, this page automatically sends you to login instead.
**On screen:** "Set up your owner account to get started" with **Your name**,
**Email**, **Password**, **Confirm password**, and a **"Create owner account"**
button. (For a normal viewer video, use `/signup` above — `/setup` is the
behind-the-scenes first boot.)

### 2.3 Log in — `/login`
**On screen:** logo, **Email**, **Password**, a **"Forgot password?"** link, and a
**"Log in"** button. Below: "New here? **Start a free trial**."
**What happens:** lands on **Today**.

### 2.4 Forgot / reset password — `/forgot-password` → `/reset-password`
**On screen (forgot):** a single **Email** box and **"Send reset link."** Whatever
you type, it always says the same thing — "If that email has an account, a reset
link is on its way" — so no one can use it to find out who has an account.
**On screen (reset, from the emailed link):** **New password** and **Confirm new
password**, then **"Set new password,"** which returns you to login.

---

## 3. Finding your way around (the parts on every screen)

These appear on every logged-in screen — film them once, early.

### 3.1 The bottom navigation bar
Fixed to the bottom of the screen, four tabs left to right:
1. **Today** — your home/dashboard.
2. **Work** — quotes, jobs, invoices, reminders.
3. **Calendar** — everything by date.
4. **Clients** — your customer list. **(Only appears if the user can see the
   client database — hidden for basic subcontractors.)**

The active tab has a silver underline.

### 3.2 The "+" button (create anything)
A round silver **"+"** floats in the middle above the nav. Tapping it dims the
screen and opens a short menu:
- **New quote** → make and send a quote (needs the quote permission)
- **Quick book a job** → book a job on the spot, no quote (needs the job
  permission)
- **Personal reminder** → put a non-job reminder on your calendar (everyone)
- **Recurring job** → set up repeating work (needs the recurring permission)

This is the fastest way to start almost anything — a good recurring shot in a
video.

### 3.3 "Install PatchUp" banner
Because PatchUp is a web app that installs like a real app, a card appears once
(dismissible) just above the nav: an icon, **"Install PatchUp,"** "Add it to your
home screen for one-tap access," an **Install** button and an **×**.
- On Android/Chrome: **Install** triggers the phone's native install prompt.
- On iPhone/Safari: **Install** shows instructions — "Tap the Share button, then
  **Add to Home Screen**."

### 3.4 "Never miss a job" notification nudge
A separate one-time card: **"Never miss a job — get a nudge an hour before each
job starts,"** with **Turn on** and **×**. (On iPhone, notifications only work
after the app is installed to the home screen — Section 17/16.4.)

---

## 4. THE CORE LOOP (the heart of the app — film this in order)

### 4.1 Add a client — `/clients/new` (or let it happen automatically)
**What it's for:** adding a customer. Note: you usually **don't need to** — a
client is created automatically the first time you quote or book them. This
screen is for adding one manually.
**On screen:** **Name** (required), **Phone**, **Email**, **Address**.
**To do it:** fill in → **Save client.**

### 4.2 Create and send a quote — `/jobs/new`  *(owner/manager, or a sub with the quote permission)*
**What it's for:** sending a customer a priced quote. This is the top of the loop.
**On screen:**
- **Customer name** (required), **Phone**, **Email**.
- A **"Record voice note"** button (microphone). *(See the voice flow in Section
  18 — you can speak the job details instead of typing and the AI fills the
  fields in.)*
- **Job type** (e.g. "Boiler service") with a small **wand** button beside it that
  tidies up your wording with AI.
- **Quoted amount (£)** (required).
- **Job location / address** (optional).
- **"Ask for a deposit"** — a tick box; when ticked, an amount box appears. Type
  the exact £ for *this* job (your call every time — no settings, no rules). The
  quote email then shows all three numbers: total, deposit to secure the
  booking, remainder on completion. The deposit is *requested* automatically the
  moment the customer accepts — offering an optional **payment link** you can
  paste right there on the form (Stripe, GoCardless…) and/or your **bank
  details from Settings** as the ways to pay; on Quick book it rides in the
  booking confirmation instead, since the job's already agreed. The link also
  pre-fills the final invoice.
- A collapsible **"Proposed date & duration (optional)"** — date, time, a duration
  number + unit (Minutes / Hours / Days / Weeks / Months), and an **"Include
  weekends"** tick. If you set a date here, accepting the quote later books the
  job in automatically.
- **Assign to** — tick which team members it's for.
**To do it:** fill it in → **Send quote** → a **confirmation card** shows the
customer, job, quote total and where it will be emailed → **Confirm & send
quote.**
**What happens:** the customer is emailed a professional quote (as set in your
templates), the job appears under **Work → Quotes** with an amber marker, and you
return to **Today.**

### 4.3 The customer replies — accept, chase, or decline
Go to **Work → Quotes** (Section 6.1). Each waiting quote has three buttons:
- **Accept quote** — the customer said yes. The job moves into **Jobs (in
  progress)**. If you'd put a proposed date on the quote, it's already booked;
  otherwise you book it next (4.4).
- **Chase quote** — sends the customer a friendly "just following up on your
  quote" email. After ~3 days, a quote is flagged "worth chasing."
- **Decline / lost job** — marks the quote lost (asks you to confirm first).

### 4.4 Book the job in — `/jobs/schedule/[job]`  *(needs the reschedule permission)*
**What it's for:** putting an accepted job on the calendar with a real date/time.
**On screen:** a summary of the job, then:
- **"Book by voice"** microphone (fills the date/time/duration for you).
- **Start date**, **Start time** (required), **Expected duration** (number + unit).
- **Job location / address** (optional).
- **"Include weekends for this booking"** tick.
- **"Let the client know"** — an **Email** tick (auto-ticked if the customer has an
  email) that sends a booking confirmation.
- If the time clashes with another job, an **amber warning** appears and the
  button changes to **"Book anyway."**
**To do it:** set date/time → **Confirm booking.**
**What happens:** the job shows on the calendar and on **Today**, and (if ticked)
the customer gets a confirmation email.

> **4.4b Quick book (shortcut) — `/calendar/quick-book`:** for booking a job on
> the spot with no quote first (e.g. you're standing in the customer's kitchen).
> Same fields as above plus name/price, and it creates the booked job in one go.
> You can invoice it properly later.

> **Every send gets a look-first card:** quotes, quick-book and recurring jobs
> all show a review card before saving — customer, price, date, and **whether
> the customer will be emailed**. Untick "Email" (or leave email blank) and the
> card warns in amber that the customer won't be notified, with "Go back" to
> change it. Nothing customer-facing happens silently.

### 4.5 Do the job, then mark it done — `/jobs/complete/[job]`  *(needs invoice permission)*
**What it's for:** finishing a job. This is where the invoice is born.
**On screen:**
- A summary (customer, job type, "originally quoted £X").
- If there are **important notes** on the job, they show in an amber banner.
- **(owner/manager)** **Final invoice amount** (pre-filled with the quote — change
  it if the work changed), **Payment due date** (defaults to 14 days out),
  **Payment link (optional)** (adds a "Pay now" button to the invoice).
- **Completion note** (optional) with an **"Enhance note with AI"** button.
- **Before / after photos (optional)** — two camera buttons (**Before**, **After**),
  each takes multiple photos. These become a permanent part of the invoice PDF.
- Button: **"Mark done & send invoice."**
**What happens:** a **confirmation card** appears first — customer, invoice
total, due date, photo count, and "the invoice will be emailed to … — it can't
be unsent" (it also flags if the amount differs from the quote). Tap **"Confirm
& send invoice"** and the job is marked complete, an invoice PDF is generated
(with your logo and any photos) and emailed to the customer automatically.
**Offline note:** if there's no phone signal, the whole thing — photos included —
is saved on the phone and a black **"Saved on this phone ✓"** panel appears; it
sends itself the moment you're back online (Section 17).

### 4.6 The invoice — `/invoices/[invoice]`
The invoice now exists on its own. Tapping it shows the rendered invoice
(number, customer, line item, due date, status) and lets you **Download PDF**,
add/change a **Payment link**, or download a **CSV** for your accountant.

### 4.7 Get paid — chase and mark paid (**Work → Invoices**)
Under **Work → Invoices** each unpaid invoice has:
- **Chase now** — emails the customer the chaser (with the invoice PDF attached).
- **Mark as paid** — records it as paid; this also triggers the automatic
  "thanks, please leave a review" email if you've set a Google review link.

**Automatic chasing:** you don't have to remember. PatchUp emails overdue
customers by itself at **3, 7 and 14 days overdue**, in wording you control.

### 4.8 That's the loop
Quote → accept → book → complete → auto-invoice → chase → paid. Everything below
is either a richer view of these steps or the admin around them.

---

## 5. Today — the home dashboard (`/`)

**What it's for:** the at-a-glance "what do I need to deal with" screen you land on
after login.
**On screen (top):** a greeting ("Good morning" + today's date) and two square
buttons — **My account** (everyone) and **Settings** (owner/manager only).
**Cards, top to bottom:**
- **Trial banner** (owner/manager, only in the last week of the trial): e.g. "3
  DAYS LEFT ON YOUR TRIAL" with **"Set up payment →."** Turns urgent (amber) at 3
  days or fewer.
- **Today's schedule** — a time-ordered list of today's jobs and reminders. Each
  row shows the time (or **"TBC"** if not confirmed). Tapping a job takes you to
  complete it (or to book it, if it still needs a time). Empty: "Nothing booked in
  for today." Link: **"View calendar →."**
- **Action needed** — a to-do list that builds itself: quotes needing a reply,
  jobs running late, jobs needing a time, jobs to book in, invoices due/overdue.
  Each line taps through to the right place. If nothing's pending, it shows an
  all-clear ("Quotes, jobs and invoices are all up to date").
- **Outstanding payments** (owner/manager) — a big £ total awaiting payment, with
  any overdue amount in red, and **"View invoices →."**

---

## 6. Work — the job control centre (`/work`)

**What it's for:** the working list of everything on the go. Four tabs across the
top.

### 6.1 Quotes tab (owner/manager)
Two sub-tabs: **Waiting response** and **Already chased.** A search box. Each quote
card (amber edge) shows the customer, "job type · £amount · quoted by {name}," and
how long ago it was sent (turns bold "worth chasing" at 3+ days). Buttons:
**Accept quote**, **Chase quote**, **Decline / lost job** (Section 4.3).

### 6.2 Jobs tab
Sub-tabs: **Today & overdue**, **Upcoming**, **Unscheduled**, **Completed.** A
search box and a **"Recurring jobs"** button. Each job card (blue; red if running
late; green when completed) shows customer, "job type · £amount · booked by
{name}" (amount hidden from subcontractors), a status line ("Running X late" /
"time to be confirmed" / "Due {date}"), and a **"View job"** button (turns amber
with a "!" if there's an important note). **(owner/manager)** an inline
**Assign / share** control lets you tick which team members a job is for, right
from the list.

### 6.3 Invoices tab (needs invoice permission)
A link to the full **invoice history export** for your accountant. Sub-tabs:
**Overdue**, **Awaiting**, **Paid (all time).** Each unpaid card (red edge) shows
the amount, due date, and days overdue, with **Chase now** and **Mark as paid**
buttons (Section 4.7).

### 6.4 Reminders tab (everyone)
Your personal calendar reminders (not jobs). A **"+ Reminder"** button, and
sub-tabs **Upcoming** and **Past.** Shared reminders note "also for {names}."

---

## 7. Calendar (`/calendar`)

**What it's for:** everything by date in one place.
**On screen:** **"+ Quick book"** and **"+ Reminder"** buttons; view tabs **Today /
Week / Month**; a ‹ › stepper to move through time with a **"Jump to today"** link.
Then day-by-day cards. Colour code (say this once in a video):
- **Blue** = booked job (**red** if it's overdue to be marked done)
- **Red money icon** = an invoice payment due (owner/manager) 
- **Purple pin** = a personal reminder
- **Gold repeat icon** = a projected recurring job ("books itself automatically
  nearer the time")

Tapping any entry opens it. Empty: "Nothing on for this week."

**Reminders — `/calendar/reminder/new`:** Title, Notes, date/time, duration, an
"Include weekends" tick, and (owner/manager) an **"Also share with"** list.
Reminders can also be created by voice. Opening an existing reminder lets you edit
or **delete** it.

---

## 8. The job sub-pages (notes and photos)

> **Deposits on the job page:** a job that asked for a deposit shows a
> **Deposit card** — amber while awaiting, green once received. When the money
> lands, tap **"Mark received"** and set the date it *actually* arrived
> (backdating is fine — mark it late, date it right; the invoice prints this
> date). Correctable until the final invoice goes out. A **"Send a deposit
> reminder"** button gives a manual nudge (with a confirm step, and a line
> underneath showing when it was requested and when the last reminder went) —
> deposits are never auto-chased. Today's "deposits awaiting" row opens a
> dedicated **Jobs awaiting a deposit** list. The
> final invoice deducts the deposit, prints the received date, and payment
> reminders chase only the balance. An unpaid deposit never blocks booking —
> it's a warning, not a gate.

Reached from **View job**:
- **Job details — `/jobs/view/[job]`:** contact info (tap to call/email), status,
  location, timing, who it's assigned to, price (owner/manager), and completion
  note. An **"Emails sent to the customer"** card lists every email PatchUp has
  sent for this job — quote, booking confirmation, invoice, follow-ups, payment
  reminders, review request — with date and time. (Emails go out from PatchUp's
  address with replies to the business, so they never appear in the
  tradesperson's own Sent folder — this card is the record.) Buttons: **Job
  notes**, **Reschedule / Book in**, **Mark done**, and **Delete** (if no
  invoice yet) or **Cancel** (if an invoice exists).
- **Job notes — `/jobs/notes/[job]`:** internal team notes, **never shown to the
  customer** (grey banner says so). Type a note, optionally mark it **Important**
  (shows amber and surfaces on the complete screen), attach a photo, tap **Add.**
  Works offline.
- **Job photos — `/jobs/photos/[job]`:** a **Before / After** photo type dropdown,
  a camera button, and Before/After galleries. Photos can be deleted (with a
  confirm). Works offline.

---

## 9. Recurring jobs (`/jobs/recurring`)  *(needs recurring permission)*

**What it's for:** work that repeats — annual boiler services, quarterly checks,
monthly maintenance. Set it up once and it books itself.
**On screen:** a **"+ New recurring job"** button and a list (blue = active, grey =
paused) showing "job type · every N weeks/months," the next date, and **Edit**,
**Pause/Resume**, and **Delete** buttons.
**New recurring job — `/jobs/recurring/new`:** customer details, job type,
location, price, first date, preferred time (or a tick to "confirm the time closer
to each one"), **Repeats every** N Weeks/Months/Years, a "let the client know"
email tick, and who it's assigned to. **Save recurring job.**
**What happens:** on schedule, PatchUp automatically creates each occurrence as a
booked job on the calendar.

---

## 10. Clients (`/clients`)  *(needs client-database permission)*

**What it's for:** your customer book.
**On screen:** a search box and **"+ Add client."** Each client card shows name,
contact, "£X OUTSTANDING" (owner/manager), and — cleverly — a red **"Possible
duplicate — tap to review"** flag if it spots two records that look like the same
person. Empty: "No clients yet — they'll appear here automatically as you send
quotes."

- **Client detail — `/clients/[id]`:** contact card (with **Edit**), a
  **duplicates** section where you can **Merge** two records into one or mark them
  "not a duplicate," and the client's full **job history.** If a client has no
  jobs, owner/manager can **Delete** them.
- **Add / edit client:** Name (required), Phone, Email, Address.

---

## 11. Invoices section (`/invoices`)  *(needs invoice permission)*

**What it's for:** the full financial record — the bit an accountant wants.
**On screen:** search; a **custom date range** (From/To) with **"View this
period"**; totals for **Total invoiced / Total paid / Outstanding**; and download
tools — pick a month (or "All invoices") and a format (**PDF** or **CSV for
QuickBooks/accountants**) and **Download.**
- **Invoice detail — `/invoices/[id]`:** the rendered invoice, a **payment link**
  editor (adds a "Pay now" button), and **Download PDF / CSV** buttons.

---

## 12. Your team (`/settings/team`)  *(owner/manager only)*

**What it's for:** adding the people who work for you and controlling what they
see.
**On screen:** the current team (name, email, role dropdown of **Manager /
Subcontractor**, a **Deactivate/Reactivate** button, and a **Permissions** link for
subcontractors), and an **"Add someone new"** form: their name, email, role, and a
starter password you share with them (they can change it later on their own
Account page).

**Permissions — `/settings/team/[member]`:** for a subcontractor, six on/off
switches, all **off by default** (they start able only to view and add notes on
their own assigned jobs):
- **Can invoice** — mark jobs done, send invoices, use the Invoices section
- **Can see the client database**
- **Can create new quotes**
- **Can quick-book new jobs**
- **Can manage recurring jobs**
- **Can reschedule jobs**

Saving shows a confirmation listing exactly what's being turned on or off.

---

## 13. Message templates (`/settings/templates`)  *(owner/manager only)*

**What it's for:** the wording of every automatic email, so it sounds like you,
not like software. Each has a subject and body with placeholders you can drop in.
Templates: **New quote**, **Invoice (job complete)**, **Manual chase**, **Auto
chase 3 days**, **Auto chase 7 days**, **Auto chase 14 days**, **Booking
confirmation**, **Review request**, **Payment link note.** Each saves on its own.

---

## 14. Business settings (`/settings`)  *(owner/manager only)*

**What it's for:** how your business appears to customers, and on your invoices.
**On screen:** a "logged in as" card with **Log out**; nav cards (**Billing**,
**Team**, **Message templates**, **Help**); then the settings form:
- **Business name**, **Header tagline** (on PDFs), **Contact email** and **Contact
  phone** (shown to customers), **Accent colour** (used on invoice PDFs),
  **Currency** (£/$/€), **Google review link** (paid customers then get an
  automatic thank-you), **Payment terms**, **Bank details**, **Invoice footer
  note.** Then **Save settings.**
- **VAT registered** — a toggle for VAT-registered businesses. Turn it on and
  enter your **VAT number** and **VAT rate** (standard UK rate 20%), then pick
  how you type prices: **"It's the total the customer pays"** (default — the
  homeowner style) or **"It's before VAT — add VAT on top for me"** (the
  commercial "£500 + VAT" style: type 500, the quote goes out as 600, and price
  fields show the total that will be charged). Either way invoices show a
  proper **Net / VAT / Total** breakdown with your VAT number, quote emails
  note that the price includes VAT, and the accountant CSV gains net/VAT
  columns. Each invoice keeps the rate it was issued with. Not registered?
  Leave it off — nothing changes.
- A **"Send a test review request to yourself"** button.
- A **Logo** uploader (shown on your invoice PDFs; best as a PNG).

---

## 15. Billing & subscription (`/billing`)  *(owner/manager only)*

**What it's for:** the plan, and the card.
**On screen:**
- **Current plan** — a big monthly total, "£X per month · N people," a **Status**
  (Free trial / Active / Payment failed / Cancelled…), and when the trial ends.
- **How it adds up** — "£19 covers you, every extra person is £8," with a **"Set up
  payment"** button (before you subscribe) or **"Manage billing"** (after). Both
  open **Stripe** in a new tab — card details never touch PatchUp.
- **If you leave** — the honest warning: 30 days after you cancel, everything is
  deleted (billing records kept 6 years for tax), and a **"Download everything"**
  button that hands you one zip of all your data. Cancelling itself is done inside
  the Stripe portal.

---

## 16. Your account (`/account`)  *(everyone)*

**What it's for:** your personal login details and this device's notifications.
**On screen:**
- **Your name** (+ Save), **Your email** (needs your password to change), **Change
  password** (current + new).
- **Notifications on this device** toggle (see 16.4).
- **Log out** (for a subcontractor this is the only logout button; logging out
  also clears the offline copy on the phone).

**16.4 Notifications toggle:** "Get a nudge before a job starts…set per device."
On iPhone it first says to install the app to the home screen; on a supported
browser it shows **"Turn on notifications,"** then **Turn off** and **Send a test**
once on.

---

## 17. Working with no signal — the field view (`/field`)

**What it's for:** vans, basements, and blackspots. This is a special screen that
works **completely offline** because it's saved on the phone.
**On screen:** a banner — green "You're online — this is your saved copy" or black
"No connection — showing your saved day" — plus when it was last saved. Then:
- **Waiting to send** — a list of anything you did offline (completed jobs, notes,
  photos) queued up, each showing "sending…" or "when signal returns," with **Try
  again / Discard** if something needed attention.
- **Your next 7 days**, kept on the phone: each job with time, customer, tappable
  phone, location and notes. You can **Complete job** (with amount, note and
  photos) and **Add note** right here with no signal — it all sends itself when
  you're back online.

Empty: "Nothing saved on this device yet. Open PatchUp once while you have signal
and your next 7 days will be kept here automatically."

---

## 18. Voice & AI features (reference)

PatchUp lets you **talk instead of type** on four screens: **New quote**, **Quick
book**, **Schedule a job**, and **New reminder.**

**The voice flow to film:** tap the **microphone** ("Record voice note" / "Book by
voice") → it turns red with a pulsing dot and says **"Stop recording"** → tap stop
→ **"Processing recording…"** → a grey **"Heard: …"** box appears with what you
said, and the form fields fill themselves in (customer, job type, amount, date,
etc.).

Separately, a **wand** button ("Enhance description" / "Enhance note with AI")
tidies up wording you've typed — turning rough notes into a clean sentence.

Everything voice/AI has a typed equivalent — nothing forces you to use it.

---

## 19. Notifications (reference)

Two ways PatchUp reaches you:
- **Daily brief email** — once a day at around **6pm UK time** (5pm in winter),
  an email to the business's contact address with tomorrow's jobs, invoices due,
  and quotes awaiting a reply. **If there's nothing on, no brief is sent** — no
  email means a clear day. Reaches you regardless of device.
- **Push notifications** — if you turn them on (Section 16.4), a nudge about an
  hour before each job starts. On iPhone this only works once the app is installed
  to the home screen.

---

## 20. Getting help — Ask PatchUp

**What it's for:** an in-app assistant that instantly answers questions about how
to use PatchUp.
**Where it is:** **Settings → Help** (owner/manager) or **My account → Help**
(everyone) — a normal screen, not a pop-up.
**On screen:** a simple chat. Type a question ("How do I send a quote?") or tap
one of the example questions, and get a short, plain-English answer.
**What it does — and doesn't:** it explains how features work, grounded only on
this guide, so it won't make things up. For billing, account issues, or anything
not working, it points you to the PatchUp team at `hello@getpatchup.co.uk`.

---

## Appendix A — Colour & status key (for consistent on-screen labelling)

- **Amber** = a quote (waiting / needs chasing), or an important note.
- **Blue** = a booked, in-progress job.
- **Red** = something overdue — a late job, or an overdue invoice/payment.
- **Green** = done/paid (completed jobs, paid invoices).
- **Purple** = a personal reminder.
- **Gold** = a projected recurring job on the calendar.
- **Grey** = paused (recurring) or declined/cancelled.

## Appendix B — Suggested video running order

1. The promise ("You finish the job; PatchUp gets you paid.") + the loop diagram.
2. Sign up / the 14-day trial (Section 2.1).
3. A tour of the bottom nav and the "+" button (Section 3).
4. **The core loop, start to finish (Sections 4.1–4.8)** — this is the film.
5. The Today dashboard and Work tabs (Sections 5–6).
6. One "wow" feature each: **voice** booking (18), **offline** completion (17),
   **automatic chasing** (4.7).
7. Admin quickies: team & permissions (12), templates (13), settings (14).
8. Billing & the free trial reassurance (15).
9. Close on install-to-home-screen (3.3) so the viewer sets it up.
