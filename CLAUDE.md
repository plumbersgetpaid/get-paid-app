# PatchUp

Job management app for UK tradespeople. The core loop: create a quote → customer
accepts → schedule the job → complete it (with photos and notes) → auto-invoice
the customer → chase automatically until they pay.

The repo directory is named `get-paid-app` for historical reasons; the product is
PatchUp.

## Stack

- **Next.js 14** (App Router, JavaScript — not TypeScript), deployed on Vercel
- **Supabase** (Postgres + Storage) — data and file storage
- **Resend** — transactional email (invoices, quotes, chasers)
- **Stripe** — subscription billing for tradespeople
- **pdf-lib** — invoice PDF generation
- Auth is custom (session cookie + `middleware.js`), not Supabase Auth

## Layout

- `app/api/**` — route handlers, one directory per action
- `app/lib/**` — shared server helpers (auth, permissions, PDF, email, Stripe,
  Supabase clients)
- `middleware.js` — session check, Stripe access gate (`hasAccess`), and
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

### 1. Job photos are in public buckets

Photos are uploaded to Supabase Storage and served via `getPublicUrl()`, which
produces permanent, unauthenticated URLs — anyone with the link can view the
inside of a customer's home. Must move to **private buckets with signed,
time-limited URLs**.

Affects two buckets, `job-photos` and `job-note-images`:

- `app/api/jobs/photos/upload/route.js`
- `app/api/jobs/complete/route.js`
- `app/api/jobs/notes/create/route.js`
- plus every read path that renders a stored URL, and
  `app/lib/getJobPhotosForPdf.js` for PDF embedding

Note stored URLs are persisted in the database, so this needs a migration of
existing rows, not just a code change. (The `logos` bucket is business branding,
not personal data — lower priority.)

### 2. No deletion mechanism

Nothing currently deletes data at 30 days. Needs a scheduled job (a fourth Vercel
cron) that **actually deletes** — database rows across all tables and the
corresponding storage objects — for accounts cancelled 30+ days ago, while
preserving Stripe billing records per the 6-year exception. Soft-delete or
flagging is not sufficient.

**Verified inventory (Aug 2026).** Every tenant-scoped table carries a
`business_id` column — uniformly, no exceptions — so deletion has one handle
across all of them:

    business_settings   invoices            message_templates   recurring_jobs
    chase_log           job_notes           personal_events     reminder_shares
    customers           job_photos          recurring_job_shares subscriptions
    ignored_duplicates  job_shares          jobs                team_members

Plus `businesses` itself (keyed on `id`), the `outstanding_invoices` VIEW, and
three storage buckets: `job-photos`, `job-note-images`, `logos`.
`platform_settings` is platform-wide and correctly has no `business_id`.

`subscriptions` is the one table the 6-year Stripe exception applies to — it must
survive the 30-day sweep.

### 3. No data export

Users must be able to get their data out before it is deleted. Needs:

- **Bulk export** of clients, jobs, quotes, invoices, payment status, and photos —
  CSVs plus the actual image files
- A **cancellation screen** that clearly warns data will be deleted after 30 days
  and links to the export

Existing narrow exports to build on: `app/api/invoices/export-csv/route.js`,
`app/api/invoices/export/route.js`, `app/api/invoices/bulk-pdf/route.js`.

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

- **`app/package.json` is a second, divergent manifest.** It still pins
  `next` 14.2.5 while the root is on 16.3.1, so it is now actively
  misleading. Vercel builds from the root; the nested file is almost
  certainly vestigial and should probably be deleted.
- **`supabase/schema.sql` is stale** — 4 tables against the live 16. Fine
  for day-to-day work (the verified inventory above is the reference), but
  a fresh deploy from this repo would produce a broken database.

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
