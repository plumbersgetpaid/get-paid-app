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

    business_settings   ignored_duplicates  job_shares          recurring_job_shares
    chase_log           invoices            jobs                recurring_jobs
    customers           job_notes           message_templates   reminder_shares
                        job_photos          personal_events     subscriptions

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

## Other known issues

- **No Node.js / lockfile in the local dev setup.** Changes have historically gone
  straight to Vercel without a local build. Run `npm install && npm run build`
  before deploying.
- **`app/package.json` is a second, divergent manifest** (different `next` and
  `resend` versions to the root). Vercel builds from the root; the nested file is
  likely vestigial and should probably be deleted.
- **`get-paid-app/public/` is not served.** Next only serves `public/` at the
  project root, which doesn't exist, so the brand PNGs there are unreachable.
