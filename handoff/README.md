# PatchUp

Job-management app for UK tradespeople. The core loop: **create a quote →
customer accepts → schedule the job → complete it (with photos and notes) →
auto-invoice the customer → chase automatically until they pay.**

> The repo is named `get-paid-app` for historical reasons; the product is
> **PatchUp**. Live at **app.getpatchup.co.uk**. Marketing site
> (`getpatchup.co.uk`) is a separate repo, `patchup-site`.

## Read these first

- **`CLAUDE.md`** — the authoritative project map: architecture, data-protection
  rules, every settled decision, and the audit history. Read it before changing
  anything.
- **`docs/app-guide.md`** — a screen-by-screen, plain-English guide to every
  feature (also published as a web page). Good for understanding what the app
  actually does from a user's point of view.
- **`supabase/live-schema-reference.md`** — the accurate database inventory (21
  tables + 1 view). The old `supabase/schema.sql` is **stale** (4 tables) — do
  not deploy from it.

## Stack

- **Next.js 16** (App Router, JavaScript — not TypeScript), on **Vercel** (Pro,
  functions pinned to `lhr1`/London).
- **Supabase** (Pro) — Postgres + private Storage, EU-hosted.
- **Stripe** (live) — subscription billing (£19 base + £8 per extra seat).
- **Resend** — transactional email, from `notifications@getpatchup.co.uk`.
- **OpenAI + Anthropic** — the optional voice/AI features.
- Auth is **custom** (HMAC session cookie + `proxy.js`), not Supabase Auth.
- Installable **PWA** with web push and an offline-first field workspace.

## Key facts a new contributor needs

- **Multi-tenant.** Every business is isolated by a random `business_id`. 21
  routes use the service-role client and must filter by `business_id`
  themselves; the rest use a scoped client the database enforces. Re-run
  `npm run test:isolation` after any schema/route change (135 checks).
- **Idempotent writes.** Mutating routes take a `request_id` and claim it before
  acting, so retries/offline replays can't double-apply.
- **Timezone model.** Scheduled times are stored as London wall-clock in a UTC
  frame; compare "now" with `nowInLondonFrame()`. See CLAUDE.md.
- **Data protection.** The app is a UK-GDPR **processor** for homeowner data
  (names, addresses, photos of the inside of homes). All account data is deleted
  30 days after cancellation (billing records kept 6 years). Treat this data as
  sensitive.

## Running locally

```bash
npm install
npm run dev        # needs .env.local (gitignored)
npm run build      # always build before deploying
npm run test:isolation   # tenant-isolation harness (needs .env.local)
```

Both repos deploy on push to `main` via Vercel.

## Database changes

SQL lives in `supabase/`. Run SQL files in the **Supabase SQL Editor** (not a
terminal). The 30-day deletion routine (`delete_business_data()` — the
authoritative copy is in `supabase/email-log.sql`; each redefinition
supersedes the last) must reach every table that stores business data — if
you add a table, add it there and re-verify.

## Status

Launch-ready. Fully built and deployed: GDPR tooling, Stripe live billing, PWA +
push, offline field workspace, and two full security/quality audits with fixes
applied. See CLAUDE.md's audit sections for detail.
