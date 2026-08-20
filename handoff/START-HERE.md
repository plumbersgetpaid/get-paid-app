# PatchUp — Project Handoff (START HERE)

**Purpose of this file:** hand this to a new Claude conversation (or a new
developer) and it will know exactly what PatchUp is, where everything lives, the
current state, and what's left to do. It is a self-contained snapshot; the repo
itself remains the source of truth.

**Snapshot date:** 20 August 2026.

**What's in this `handoff/` folder** (a portable snapshot — the live repo stays
the source of truth):
- `START-HERE.md` — this file.
- `CLAUDE.md` — the authoritative project map.
- `README.md` — the repo readme.
- `app-guide.md` / `app-guide.html` — the screen-by-screen app guide.
- `live-schema-reference.md` — accurate database inventory.
- `offline-plan.md` — offline architecture scope.
- `sql/` — the database functions/constraints (already applied in Supabase).
- `logos/` — the PatchUp emblem + app icons.

---

## 1. What PatchUp is

A job-management app for UK tradespeople (plumbers, electricians, builders…). The
whole product is one loop:

> **Quote → customer accepts → schedule the job → complete it (photos + notes) →
> auto-invoice the customer → chase automatically until paid.**

Sole builder/founder: **Blaise** (trading as a sole trader for now; will form a
limited company when he goes beyond friends-and-family users). New to coding —
see §11 for how to work with him.

---

## 2. Two repos, two domains

Both under `~/Developer/GitHub/` (moved out of `~/Documents` on 18 Aug 2026
because iCloud was spawning conflict-copy files):

- **`get-paid-app`** — the app. Live at **app.getpatchup.co.uk**. Named
  "get-paid-app" for historical reasons; the product is PatchUp.
  **`CLAUDE.md` in this repo is the authoritative project map — read it first.**
- **`patchup-site`** — the marketing site, a single `index.html`. Live at
  **getpatchup.co.uk**. Its footer links to the app's `/privacy` and `/terms`.

Both deploy on **push to `main`** via Vercel. When legal pages, pricing, signup,
or branding change in the app, check whether the marketing site needs the same
change (its links/copy drift silently otherwise).

---

## 3. Current status — LAUNCH-READY

Everything is built, deployed, and audited. Specifically live:

- Custom auth, multi-tenant isolation, full core loop (quote→paid).
- **Stripe in LIVE mode**, fully configured (see §5).
- PWA + web push + a daily-brief email + an offline field workspace.
- GDPR tooling: 30-day deletion job, full data export, private photo storage.
- **Two full audits done and fixed** — an initial pass (18 Aug) and a deeper
  four-agent self-audit (20 Aug). See CLAUDE.md's two "audit" sections.

### Open items (none block a friends-and-family launch)
- **Limited company** — currently a sole trader ("Blaise" named on the legal
  pages). Before a *public* launch, incorporate and swap the company
  name/number/registered office into `app/privacy/page.jsx`, `app/terms/page.jsx`
  and the `patchup-site` footer. This also supplies the required contact address
  without exposing a home address.
- **Solicitor review** of `/terms` before taking paying strangers. The terms now
  include a plain-English Article-28 processor commitment; a solicitor glance is
  belt-and-braces, not urgent.
- **Self-host the Google font** on `patchup-site` (minor GDPR nicety — currently
  sends visitor IPs to Google). Not a launch blocker.

---

## 4. Infrastructure & accounts

- **Supabase Pro** — Postgres + private Storage, EU-hosted, daily backups, no
  pausing. Buckets: `job-photos`, `job-note-images` (both private; links signed
  on read via `lib/signedMediaUrls.js`).
- **Vercel Pro** — commercial use + sub-daily crons. Functions pinned to `lhr1`
  (London) next to the EU database — **do not remove the `regions` setting from
  `vercel.json`.**
- **Resend** — domain `getpatchup.co.uk` verified. App sends from
  `notifications@getpatchup.co.uk`; every customer-facing email sets Reply-To =
  that business's `contact_email`. Receiving mailbox `hello@getpatchup.co.uk` is
  a real iCloud Custom Email Domain mailbox.
- **OpenAI + Anthropic** — voice transcription + text structuring (the voice/AI
  features only).
- **Web push** — VAPID keys in env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- Secrets live in Vercel env and local `.env.local` (gitignored). **Never ask
  Blaise for secrets in chat.**

---

## 5. Stripe (LIVE) — how billing works

- **Pricing:** graduated tiered price — £19 for the first seat, £8 for each
  additional seat. 14-day free trial, no card required to start.
- The app owns the seat count: `lib/syncStripeSeats.js` updates the Stripe
  subscription quantity whenever a team member is added/removed/toggled.
  **Quantity editing is OFF in the Stripe customer portal** because of this.
- Configured in live mode: dunning emails on (fail/expiring/trial-reminder), 3DS
  + hosted confirmation links + payment reminders, failed-payment retries →
  cancel, disputes → cancel immediately, portal live (cancel at period end,
  reasons collected).
- **Webhook** (`app/api/billing/webhook/route.js`) throws on any failed DB write
  so Stripe retries — never silently 200-acks a lost subscription-state change.
- **Launch-day ritual:** do one real £19 self-subscription to witness the live
  webhook end-to-end, then cancel.

---

## 6. Architecture essentials (the things that will bite you if unknown)

- **Auth is custom** — session cookie + `proxy.js` (NOT `middleware.js`; Next 16
  renamed it). `proxy.js` is the tenant-isolation gate: session check, Stripe
  access gate (`hasAccess`), per-permission route gating. Anything that stops it
  being picked up makes every route public — re-run the unauthenticated-redirect
  check after touching it.
- **Multi-tenant isolation** — random UUID `business_id`. ~21 routes use
  `supabaseAdmin()` (bypasses RLS) and MUST filter by `business_id`; the rest use
  `getScopedDb()` which the DB enforces. The rule: a cross-business read is fine
  *if each row is handled on its own terms*; it's a leak *if one business's data
  is compared against or shown to another*. **Re-run
  `npm run test:isolation` (135 checks) after any schema/route change.**
- **Idempotency** — mutating routes take a client `request_id` and claim it in
  `processed_requests` before acting (`lib/idempotency.js`). Retries get the
  success response; failures release the claim. A new mutating route MUST follow
  this pattern.
- **Offline-first** — `/field` is a public, dataless shell rendered from an
  on-device pack (IndexedDB, next 7 days); `lib/outbox.js` queues
  complete-job/note/photo actions offline and replays them oldest-first,
  reusing each action's `request_id` so replays can't double-apply. Scope doc:
  `docs/offline-plan.md`.
- **Timezone** — scheduled times are stored as **London wall-clock in a UTC
  frame**. Displays read them back without a timeZone. Compare against "now" only
  via `nowInLondonFrame()` (`lib/today.js`); never against a raw `new Date()`.
  Real instants (`trial_ends_at`, `locked_until`, `reset_token_expires`) use
  plain `new Date()`.
- **Speed is a product rule** — staleTimes + prefetch on the 4 nav tabs + React
  `cache()` dedup + a `loading.jsx` skeleton + `lhr1` pinning. Don't regress it;
  don't blanket-prefetch list rows.
- **Crons (5, in `vercel.json`, all CRON_SECRET-gated):** recurring-jobs (6am),
  chase (9am), delete-cancelled (3am), daily-brief (17:00), starting-soon (every
  15 min — needs Vercel Pro).

---

## 7. Data protection & retention (settled)

The app is a UK-GDPR **processor** for homeowner data (names, addresses, and
photos of the inside of private homes); the tradesperson is the controller.

- **All account data is deleted 30 days after cancellation.** Exception: Stripe
  billing records kept **6 years** for UK tax.
- `delete_business_data()` (in `supabase/idempotency.sql`) is the deletion
  routine — it must reach every table that stores business data. If you add a
  table, add it there and re-verify (backdate a cancellation + dry-run).

---

## 8. Roadmap decisions (agreed 20 Aug 2026)

- **AI help box — BUILT (20 Aug 2026).** "Ask PatchUp" at `/help`, linked from
  Settings and My account (not a pop-up). Grounded strictly on
  `app/lib/helpKnowledge.js`; hands billing/account/legal to the PatchUp team;
  logs questions to `help_questions`. Needs `supabase/help-questions.sql` run
  once for logging. See CLAUDE.md "Ask PatchUp". Keep `helpKnowledge.js` in sync
  with the real app or it will describe features that don't exist.
- **Referral program — DECLINED for now.** Blaise's call: the 14-day free trial
  already serves "try before you pay," and a cash bounty this early invites
  gaming. If revisited: two-sided free-**month credit** (not cash), gated on the
  referred business becoming a paying subscriber.

---

## 9. Standing rituals / things to check around launch

- Launch-day: one real £19 self-subscription to witness the live webhook, then
  cancel.
- Check the first Supabase daily backup actually landed.
- ~17 Sept 2026: confirm the delete-cancelled cron logged its first real run
  cleanly (30 days after the first cancellations).
- Verify the Stripe statement descriptor reads sensibly on a real card statement.

---

## 10. Key files & where to look

| Need | File |
|------|------|
| Authoritative project map | `CLAUDE.md` |
| What the app does, screen by screen | `docs/app-guide.md` (+ `.html`) |
| Accurate DB schema | `supabase/live-schema-reference.md` |
| Offline architecture | `docs/offline-plan.md` |
| Deletion routine + idempotency table | `supabase/idempotency.sql` |
| Login throttle function | `supabase/login-throttle.sql` |
| One-invoice-per-job constraint | `supabase/invoice-unique.sql` |
| Tenant-isolation harness | `scripts/isolation-test.mjs` (`npm run test:isolation`) |
| Auth / permission gate | `proxy.js`, `app/lib/permissions.js` |
| Seat billing sync | `app/lib/syncStripeSeats.js` |

---

## 11. How to work with Blaise

- **New to coding** — doesn't know terminal, git, or SQL conventions. Explains
  things in product terms; expects plain-English answers.
- **Always say WHERE a command runs** — Terminal vs the Supabase SQL Editor. This
  distinction is not obvious to him and unlabelled instructions stall the work.
- **One step at a time.** Give one action, confirm it landed, then the next.
- **He tests on the LIVE site by habit** — always say explicitly when a change is
  only local/unpushed. Before debugging a "it doesn't work" report, check whether
  the change is actually deployed.
- **Division of labour that works:** Claude edits/commits/verifies and can push
  when asked; Blaise runs SQL in Supabase and tests on his phone.
- **He finds real bugs by using the product** — take vague reports seriously and
  reproduce/diagnose rather than asking him for technical detail.
- **Never ask him for secrets in chat.**
- For test logins, mint a session via `SESSION_SECRET`; he is the owner of
  business `00000000-0000-0000-0000-000000000001`.

---

## 12. If you're a fresh Claude picking this up

1. Read `CLAUDE.md` (authoritative) and skim `docs/app-guide.md` (what it does).
2. Confirm what's deployed vs local before changing behaviour.
3. Follow the isolation/idempotency/timezone rules above — they are the
   easy-to-miss traps.
4. Next planned build is the **AI help box** (§8). After that, revisit the open
   items in §3.
