# PatchUp

Job management app for UK tradespeople. The core loop: create a quote → customer
accepts → schedule the job → complete it (with photos and notes) → auto-invoice
the customer → chase automatically until they pay.

The repo directory is named `get-paid-app` for historical reasons; the product is
PatchUp.

## Stack

- **Next.js 16** (App Router, JavaScript — not TypeScript), deployed on Vercel
- **Supabase** (Postgres + Storage) — data and file storage
- **Resend** — transactional email (invoices, quotes, chasers)
- **Stripe** — subscription billing for tradespeople
- **pdf-lib** — invoice PDF generation
- Auth is custom (session cookie + `proxy.js`), not Supabase Auth

## Layout

- `app/api/**` — route handlers, one directory per action
- `app/lib/**` — shared server helpers (auth, permissions, PDF, email, Stripe,
  Supabase clients)
- `proxy.js` — session check, Stripe access gate (`hasAccess`), and
  per-permission route gating
- `supabase/schema.sql` — **stale**, covers only 4 early tables. The accurate
  inventory is **`supabase/live-schema-reference.md`** (23 tables + 1 view,
  read-only probed Aug 2026) — use that, and don't deploy from schema.sql.
- `README.md` — rewritten 20 Aug 2026 and now accurate (points here and at the
  app guide). schema.sql above remains the one file never to trust.

Five Vercel cron jobs (`vercel.json`) — see the Notifications section for the
full list: recurring-jobs (6am), chase (9am), delete-cancelled (3am),
daily-brief (17:00), starting-soon (every 15 min, needs Vercel Pro).

## Data protection — read before touching customer data

Our users are tradespeople. The app also stores data about **their** customers
(homeowners): names, addresses, phone numbers, and **photos taken inside private
homes**. Under UK GDPR we are a **data processor** for that data — the tradesperson
is the controller. Treat homeowner data as sensitive by default, and assume any
feature touching it has compliance consequences, not just product ones.

### Retention decision (settled)

- **All data is deleted 30 days after account cancellation.**
- **Exception:** Stripe billing records are kept **6 years** for UK tax purposes.

Apply this rule when designing anything that stores, copies, or exports data —
new tables and buckets need to be reachable by the deletion job.

## Outstanding pre-launch work

These four items block launch. They are known gaps, not bugs to rediscover.

### 1. Job photos in public buckets — DONE (Aug 2026)

`job-photos` and `job-note-images` are private. Links are signed on read
via `lib/signedMediaUrls.js` — one hour for browsing, five minutes for a
PDF being generated server-side in the same request. Both tables already
recorded `storage_path`, so the path is the record and the `url` /
`image_url` columns are no longer written or read.

Signing runs on the admin client, because creating a signed URL needs
storage permissions the scoped client doesn't carry. **Callers must have
already established access** — every current call site sits behind
`canAccessJob`, a permission gate, or the proxy. Signing hands out a
short-lived link to something already authorised; it does not authorise.

Moving this to storage-level policies keyed on `business_id` would be
stronger — database-enforced rather than app-enforced — but needs every
existing object relocated to a path structure containing the business.
Worth revisiting in the audit.

Two things this cost, both worth remembering:

- `job_photos.url` was `NOT NULL`. Writing null to it broke every photo
  insert. Check column constraints before changing what a write puts in
  them.
- That insert's error was never checked, so the failure was invisible:
  file uploaded, row rejected, photo silently gone. It had already lost a
  photo on 10 Aug, before any of this. **Sweep for other unchecked writes
  during the audit** — this one proved the pattern loses real data.

### 2. Deletion at 30 days — DONE and verified (Aug 2026)

`api/cron/delete-cancelled` runs daily at 3am. Storage first (the paths
come from job ids), then one transactional call to
`delete_business_data()`. `?dryRun=1` reports without deleting.

Kept: the `subscriptions` row and the `businesses` name — the billing
record held 6 years for UK tax. Everything else goes outright.

Ordering is dictated by the foreign keys, which are almost all NO ACTION —
nothing cascades from the business down:
`chase_log → invoices → jobs → customers`, with `team_members` last
because jobs, notes, personal events and recurring jobs all reference it.

**Verified against the live database, not just reasoned about:**

- Backdating a cancellation 31 days made the dry run report that account
  and no other; restoring matched the original value exactly.
- A throwaway business with a real chain — team member, client, job
  created by *and* assigned to that member, notes, shares, recurring job,
  recurring share, invoice, chase log, photo row — deleted with zero
  leftovers across all 15 tables, subscription and business name intact.

Re-run those two checks if the schema gains a table or a foreign key.
The ordering is hand-derived, and nothing in the code enforces it.

### 3. Data export — DONE (Aug 2026)

`/api/export/everything` returns one zip: clients, jobs, quotes, invoices
(with payment status and dates), job notes and recurring jobs as CSV,
plus the photos as real files in a folder per client, and a README.

Photos are the only unbounded part — 150MB budget, past which the rest
are listed in `photos.csv` with a 7-day signed link each rather than the
export timing out and producing nothing.

Gated on `canSeeEverything`: this is every customer, invoice and photo in
one file.

The billing page carries the cancellation warning and the export button
together. Cancelling itself happens in Stripe's portal, which we can't
put a warning inside — so it has to be on our side of that link.

### 4. Remove Twilio — DONE

Completed. `app/lib/sendWhatsApp.js` deleted, all 5 call sites removed, the
`notifyWhatsapp` form parsing dropped from 4 routes, and the `twilio` dependency
stripped from both package.json files.

**This was a deliberate product decision, not a cleanup: customer notification is
email-only.** WhatsApp was built, then abandoned in favour of email automation.
Don't reintroduce Twilio or SMS/WhatsApp sending without checking first — the
absence is intentional.

One follow-up still open:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` may still be
  set in Vercel — remove them there.

Done: the `notify_whatsapp` column on `recurring_jobs` has been dropped (confirmed
gone from the live table, Aug 2026).

## Brand assets

`public/` holds the emblem used as the default browser-tab icon, generated
from the vector source rather than traced by hand:

- `patchup-emblem.svg` — square, rounded black tile, white emblem
- `patchup-emblem.png` — 512px render of the same, fallback for browsers
  that won't take an SVG favicon

The full brand pack (six colourways — black, white, silver, orange, red,
baby blue — each as .ai/.eps/.pdf/.svg/.png/.jpg) is not in the repo. Its
naming is not self-explanatory, so for reference:

- `-01` = emblem only (the jigsaw parallelogram)
- `-02` = wordmark only ("PatchUp" set in the brand face)
- `-03` = full lockup, emblem above wordmark

Use `-01` anywhere the mark appears small — favicons, app icons, the
sign-off mark. The lockup is unreadable below about 100px.

## Audit findings (Aug 2026)

Full pass done 18 Aug 2026. Fixed: the `outstanding_invoices` view leaked
all unpaid invoices to the bare anon key (views default to owner
privileges — RLS never applied; now `security_invoker`), RLS was never
enabled on `businesses`/`subscriptions`/`platform_settings` (Stripe ids
readable), and the six worst of 32 error-discarding writes (the repeat-
email and money-state ones). The dead browser Supabase client is removed —
keep it that way; server-only access means the anon key's reach doesn't
depend on every table's RLS being perfect.

Still open, deliberately:

- **26 remaining unchecked writes** — child-row deletes and log inserts,
  failure recoverable. List them for the outside review with
  `grep -rn 'await db.from' app | grep -v 'error'` and judgement.
- **`scripts/isolation-test.mjs`** — 135 checks (count grows with the
  harness; trust its own output), re-run after any schema
  or route change: `node --env-file=.env.local scripts/isolation-test.mjs`
- New views MUST set `security_invoker = true` — the default is the trap
  that caused the worst finding of this audit.

## Invoice access = job access (per-job, not just the flag)

Invoices are job-child resources, so acting on one follows the JOB's rule
(like notes/photos/schedule/complete), NOT the bare `can_invoice` flag. A
subcontractor with `can_invoice` may only touch invoices for jobs assigned to
(or shared with) them. Enforced by `canAccessInvoice()` (app/lib/jobAccess.js)
on every single-invoice route: `[invoiceId]/pdf`, `mark-paid`,
`set-payment-link`, `invoices/chase`. Whole-business invoice EXPORTS
(`bulk-pdf`, `export-csv`, `export`) and the aggregate list VIEWS are
owner/manager only (`canSeeEverything`); the Work→Invoices tab and `/invoices`
page filter to the member's own jobs for a subcontractor (via
`getAccessibleJobIds`). Added in the 4th audit (Aug 2026) - before it,
`can_invoice` leaked every invoice in the business to a subcontractor and let
them mark any invoice paid / redirect any payment link. If you add a new
invoice route, gate it with `canAccessInvoice` (single) or `canSeeEverything`
(aggregate/export).

## Service-role queries and business scoping

~28 API routes use `supabaseAdmin()`, which bypasses row-level security. The
~49 routes on `getScopedDb()` are protected by the database itself; the
admin-client ones are not, and must filter by `business_id` themselves.
(Counts drift as routes are added — the rule is what matters.)

A cross-business sweep is not automatically a bug. The rule that separates
the two, learned from a real leak in the recurring clash check (Aug 2026):

- **Safe:** each row is handled on its own terms — the daily chase reads
  every outstanding invoice, but each email goes to that invoice's own
  business. Same for job reminders. The set is global; the handling is not.
- **A leak:** a row from one business is *compared against, or reported
  to*, another. The recurring clash check searched every business's jobs
  for a time overlap, then emailed the customer's name and job type of
  whatever it found — so one business could be told another's customer
  details.

When reviewing a `supabaseAdmin()` query, the question is not "does this
read other businesses' rows" but "does anything from another business end
up in front of this one".

## Other known issues

- **`supabase/schema.sql` is stale** — 4 tables against the live 23+view.
  Fine for day-to-day work (`supabase/live-schema-reference.md` is the
  reference), but a fresh deploy from this repo would produce a broken
  database.

## Second full audit (20 Aug 2026)

A four-agent pass (code delta, GDPR/data inventory, website+terms, debt +
live schema) run "as if no outside reviewer follows". Code fixes landed:

- **Stripe webhook now fails loud** — all subscription-state writes throw on
  a DB error so Stripe retries, instead of 200-acking a lost update (a
  cancelled sub could have stayed `active`, or a failed payment never gone
  `past_due`). `app/api/billing/webhook`.
- **Push respects deactivation** — `sendPushToMember` gates on `is_active`,
  so a deactivated member's phone stops getting job nudges carrying
  homeowner names/addresses. `team/delete` now also removes their
  `push_subscriptions` (no FK, so nothing else did).
- **starting-soon claims its dedupe stamp BEFORE sending** (both loops), so
  a failed write can't re-fire the same push every 15 min.
- **Silent access-revocation fixed** — `jobs/unshare`, `reminder/update`,
  `recurring/update` now surface a failed removal instead of reporting
  success while the person keeps access.
- **Chase records checked** — `invoices/chase`, `cron/chase`,
  `chase-quote` log/stamp writes are checked so a lost record doesn't
  invite a duplicate customer email.
- **Login throttle is now atomic** (`record_login_attempt()` RPC —
  `supabase/login-throttle.sql`), fixing the parallel-burst bypass, with
  login and password-reset on **separate counters** so one can't lock the
  other. The RPC self-purges IPs >24h (GDPR).
- **Double-invoice**: unique constraint on `invoices.job_id`
  (`supabase/invoice-unique.sql`) + 23505 handling in `jobs/complete`.
- **push/subscribe** validates the endpoint host (SSRF guard) and caps rows
  per member. **daily-brief** pins `timeZone:UTC`. **sw.js** warm-field no
  longer double-fetches. **PhotoUploadForm** stops navigating to the raw API
  URL on error.
- **Export completeness** — `/api/export/everything` now includes chase log,
  reminders, email templates, team roster, settings, and **note images**
  (previously omitted entirely).

All run-once SQL (login-throttle, invoice-unique, vat, help-questions,
email-log, cancelled-jobs-stop-chasing) **has been applied to the live DB —
verified by direct probe 20 Aug 2026** (tables/columns/RPC/view/guard all
present). The authoritative `delete_business_data()` is the copy in
`supabase/email-log.sql` (each redefinition supersedes the last; running an
older file's copy would drop newer tables from the 30-day deletion).
Legal/marketing items (DPA, terms clauses, solicitor review) are tracked for
the founder + solicitor, not code.

## Email sending (professional domain)

Domain `getpatchup.co.uk` is verified in Resend. All app email sends from
**`notifications@getpatchup.co.uk`** (set via `RESEND_FROM_ADDRESS` in
Vercel) — a send-only label, no mailbox needed. `getEmailFrom(businessName)`
builds `"<Business Name> <notifications@getpatchup.co.uk>"`, and every
customer-facing send sets **Reply-To = that business's `contact_email`**, so
replies reach the business, never the platform. `contact_email` defaults to
the owner's signup email and can no longer be blanked (settings/route.js
falls back to the owner's email), so reply routing can't break.

Receiving: `hello@getpatchup.co.uk` is a real iCloud Custom Email Domain
mailbox (Apple auto-configured the GoDaddy DNS). It's the founder business's
own contact address and where its customer replies land. Apple (root MX +
SPF + DKIM + apple-domain TXT) and Resend (send subdomain + resend._domainkey)
coexist; a single DMARC record on `_dmarc`.

Future feature (not built): per-business sending domains so each tenant can
send from their own domain — Resend supports multiple domains via API, and
auto-setup (Entri) makes the DNS near one-click, but it's opt-in and only
for tenants who own a domain. Default (name + reply-to) works for everyone.

## Offline plan + retry protection

The offline-first build is scoped in **docs/offline-plan.md** (read it
before touching this area). Phase 0 is DONE (Aug 2026): every create/send
action carries a client-generated `request_id`; twelve routes claim it
atomically in `processed_requests` via `lib/idempotency.js` before acting.
Replays get the success response; failures after claiming release the id.
Verified live: five parallel submits of one action = one row.

Rules this creates:
- A NEW mutating route that creates or sends anything MUST take a
  `request_id` (forms: render `<RequestIdField />`; fetch: sticky ref,
  reset on confirmed success) and claim it. Copy the pattern from
  clients/create.
- Release on every post-claim failure path, or a user's legitimate retry
  is refused as a duplicate of something that never happened.
- `processed_requests` is purged >30 days by the delete-cancelled cron and
  is covered by delete_business_data().

Phase 1 is DONE (Aug 2026): `/api/field-pack` (scoped via
filterJobsForMember) → IndexedDB via `lib/fieldPackStore.js`, kept fresh by
`FieldPackSync`; `/field` is a PUBLIC dataless shell rendered from the
device pack (times shown by slicing stored wall-clock strings — never Date
formatting, see the timezone note); the service worker falls back to
/field for failed navigations and caches only /field + immutable
/_next/static assets. Logout clears the pack. The isolation harness has a
field-pack area — keep it passing.

Phase 2 is DONE (Aug 2026): `lib/outbox.js` (IndexedDB v2, cap 50) queues
complete-job / job-note / photo actions on network failure, replayed
oldest-first by FieldPackSync (outbox BEFORE pack refresh). Safety: entries
reuse the action's own request_id (replays can't double-apply — proven:
photo ×3 → 1 row, complete ×2 → 1 invoice); server rejections become
"needs attention" on /field (Try again / Discard), never silently dropped;
an expired session is detected via the /login redirect and the queue
HELD; logout warns before destroying unsent work, then clears everything.
The privacy policy's "Data stored on your device" section describes this —
keep it true if the pack's contents change.

Phase 3 remainder: nothing structural — the GDPR pieces (logout clear,
policy disclosure) and test coverage (field-pack isolation area, replay
proofs) shipped with Phases 1–2. Treat any new offline-capable action as:
reuse request_id + queueAction, and extend the isolation harness.

## Notifications

Two channels, by design:

- **Email daily brief** (`api/cron/daily-brief`, 17:00 UTC): tomorrow's jobs,
  invoices due tomorrow, quotes awaiting a reply. One email per business,
  skipped when empty. Reaches everyone regardless of device.
- **Web push** (installable PWA): `lib/push.js` sends via web-push; the
  service worker (`public/sw.js`) shows the notification and deep-links on
  tap. Per-device opt-in on the account page (`NotificationToggle`).
  Subscriptions in `push_subscriptions`; dead ones auto-pruned on 404/410.
  `api/cron/starting-soon` (every 15 min) nudges ~1h before a job or
  personal reminder, keyed on `reminder_sent_at` so each fires once (a
  reschedule clears it). iPhone push only works when installed to the home
  screen.

VAPID keys live in env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (read at runtime and
passed to the client as a prop — NOT relied on for build-time inlining),
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (must be a mailto: or https URL).
`sendPushToMember` degrades to a no-op with a log if VAPID is misconfigured
rather than throwing.

Crons now: recurring-jobs (6am), chase (9am), delete-cancelled (3am),
daily-brief (17:00), starting-soon (*/15). Needs Vercel Pro for the
sub-daily one.

## Ask PatchUp (in-app help assistant)

An AI help box at `/help`, linked from **Settings** (owner/manager) and **My
account** (everyone) — a normal screen, deliberately NOT a floating pop-up.
`app/api/help/ask/route.js` calls Anthropic (Haiku, same key as voice) with a
system prompt that is grounded **strictly** on `app/lib/helpKnowledge.js` (a
condensed mirror of `docs/app-guide.md`). Guardrails: how-to questions only;
never invent features; hand billing/account/legal/bugs to
`hello@getpatchup.co.uk` ("connect you to the PatchUp team"); refuse off-topic.

Every question+answer is logged to **`help_questions`** (product feedback) —
business-scoped, service-role only, and included in `delete_business_data()`.
**If `helpKnowledge.js` drifts from the real app, the assistant will describe
features that don't exist — update it in the same change as any UX change.**
Needs `supabase/help-questions.sql` run once (the box still answers without it;
it just won't log).

## Deposits (v1: request + track)

Per-job tick box + amount on the quote and quick-book forms (deliberately NO
settings/thresholds - the tradesperson decides per job). Flow: quote STATES
total/deposit/remainder -> acceptance SENDS the deposit_request email (bank
details; quick-book asks within the booking confirmation, since booking is
acceptance) -> job shows "awaiting deposit" (job page card, Today action row,
work card - all canInvoice-gated) -> "Mark received" records an ADJUSTABLE
backdatable deposit_received_on date (locked once the invoice exists) ->
completion snapshots deposit_amount/deposit_received_on onto the invoice.

Rules: invoices.amount stays the FULL total (financial record + VAT base);
the BALANCE (amount - deposit, floored at 0) is what every customer-facing
surface says is owed - invoice email/PDF, chase emails, overdue lists,
outstanding totals. Only a RECEIVED deposit deducts; requested-but-unpaid
invoices the full amount. Deposits are never auto-chased (manual
jobs/deposit/chase route) and never block booking. Templates:
deposit_request, deposit_chase. email_log kinds: deposit_request,
deposit_chase. SQL: supabase/deposits.sql (jobs + invoices columns + view
gains deposit columns). PatchUp still never touches the money.

## Email log ("did that email actually send?")

Tradespeople have no Sent folder - mail goes out from the platform address.
`email_log` (supabase/email-log.sql) records every customer-facing send:
quote, booking_confirmation, invoice, quote_chase, review_request (invoice
chasers stay in `chase_log`; the UI merges both). Logged via
`lib/logEmail.js` at all seven send sites (the two invoice-chase sends are
recorded in `chase_log` instead), best-effort AFTER the send (never
blocks it, but failures log loudly). Surfaced as "Emails sent to the
customer" on `/jobs/view/[jobId]`, and in the export as emails-sent.csv.

`email_log` is **service-role only** (RLS on, no policies - same posture as
processed_requests): every read/write goes through the admin client and MUST
filter/set `business_id` explicitly. It's in delete_business_data(). **A new
customer-facing send site must call logEmailSent()** or the job page
under-reports what the customer received. Note: `sent_at` is a true UTC
instant - display with timeZone "Europe/London", unlike wall-clock job times.

## Speed is a feature

Founder's product rule (Aug 2026, after side-by-side with a native
competitor): tradespeople have short attention spans and "a bit slow" is
always the first trial feedback. Every interaction must respond visually
at once - if the data takes time, a skeleton shows instantly, never a
frozen screen.

What delivers it today, and must not regress:
- Functions pinned to lhr1 beside the EU database (vercel.json `regions`)
- `experimental.staleTimes` {dynamic:30, static:60} - recently visited
  pages render from the client cache; mutations still appear immediately
  because every write path busts it (revalidatePath / full 303 nav)
- `prefetch={true}` on the four BottomNav tabs (always on screen, so
  their pages load before the tap). Do NOT blanket this onto list rows -
  a 50-job list would fire 50 full prefetches; row taps are covered by
  the root loading.jsx skeleton instead
- Per-request dedupe of member/settings lookups via React cache()
- The service worker's navigationPreload (worker wake-up in parallel
  with the network, not in series)

The remaining gap to true native feel (every FIRST visit instant) is the
local-first architecture - the deliberate post-launch mountain in
docs/offline-plan.md, not something to bolt on casually.

## Time and timezones

Scheduled times (`jobs.scheduled_start/scheduled_end`, `personal_events`,
recurring occurrences) are stored as **London wall-clock in a UTC frame**:
they're written by parsing the user's typed time on a UTC server
(`new Date(`${date}T${time}:00`)`), so 16:00 London is stored as `16:00Z`.
Displays read them back without a timeZone, so the user sees "16:00" again —
self-consistent, and intentional for a UK-only product.

The one thing this breaks is comparing a stored time against a real
`new Date()`: during BST the stored value is an hour behind the true
instant, so "running late"/"upcoming" flip an hour late. Use
`nowInLondonFrame()` from `lib/today.js` for those comparisons — it returns
the current London wall-clock in the same stored frame. **Never** compare it
against a true UTC timestamp (`trial_ends_at`, `locked_until`,
`reset_token_expires` — those are real instants and use plain `new Date()`).

If the product ever goes non-UK, this model has to change to true-UTC
storage plus `timeZone`-aware display, which is a data migration of every
stored scheduled value.

## Stack notes

- **Next 16.3.1 / React 19.2.8** since Aug 2026, upgraded from 14.2.35/18
  to clear 21 security advisories. `params` and `searchParams` are
  Promises — await them in pages and route handlers.
- **`proxy.js`, not `middleware.js`** — Next 16 renamed the convention.
  This file is the tenant-isolation gate: it checks the session, the
  Stripe access gate, and per-permission route access. Anything that stops
  it being picked up silently makes every route public, so re-run the
  unauthenticated-redirect check after touching it.
- Local dev: `npm run dev`, needs `.env.local` (gitignored). Node and a
  committed lockfile are in place as of Aug 2026; `npm run build` before
  deploying.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
