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
- `supabase/schema.sql` — **stale**, covers only 4 early tables; the live schema
  has many more (users, teams, subscriptions, reminders, recurring jobs, notes,
  photos, settings)
- `README.md` — **stale**, describes an early single-user email-only version and
  lists features as unbuilt that now exist. Don't trust either file as a
  description of current behaviour; read the code.

Three Vercel cron jobs (`vercel.json`): recurring job creation (6am), job
reminders (7am), overdue invoice chasing (9am).

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

Two follow-ups still open:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` may still be
  set in Vercel — remove them there.
- The `notify_whatsapp` column on `recurring_jobs` is no longer written. Drop it
  once confirmed nothing depends on it.

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
- **`scripts/isolation-test.mjs`** — 126 checks, re-run after any schema
  or route change: `node --env-file=.env.local scripts/isolation-test.mjs`
- New views MUST set `security_invoker = true` — the default is the trap
  that caused the worst finding of this audit.

## Service-role queries and business scoping

21 API routes use `supabaseAdmin()`, which bypasses row-level security. The
46 routes on `getScopedDb()` are protected by the database itself; these 21
are not, and must filter by `business_id` themselves.

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

- **`supabase/schema.sql` is stale** — 4 tables against the live 16. Fine
  for day-to-day work (the verified inventory above is the reference), but
  a fresh deploy from this repo would produce a broken database.

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
