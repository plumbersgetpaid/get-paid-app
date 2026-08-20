# Offline-first PatchUp — scope and build plan

*Drafted 19 Aug 2026, before any build. The decision: offline goes in
BEFORE launch, while there are zero users — retrofitting a foundation
under live users is riskier than building it on an empty system.*

## Why (the validated problem)

Tradespeople work in dead zones — rural jobs, basements, new builds with
no wifi. Direct feedback (a gas engineer on a GasSafe-type app): the app
is unusable without signal, and worse, flaky connections cause glitches
and duplicates when actions half-send and get retried. Both problems are
in scope:

1. **Dead zone:** can't see the day's jobs, can't record work done.
2. **Flaky connection:** taps that half-fail then duplicate on retry.

## Architecture decision — hybrid, not rewrite

The app is server-rendered (Next 16 App Router; screens fetch from
Supabase per request). A full local-first rewrite (every screen reading a
synced client database) would discard the architecture we just audited
and stabilised — weeks of work and a new bug surface everywhere.

Instead: **the online app stays exactly as it is.** We add an offline
layer for the field workflow only:

- A **field pack**: the next 7 days of the tradie's own jobs (times,
  customer name/phone/address, job type, notes), saved to the device
  (IndexedDB) every time the app loads online.
- An **offline day view**: when the network is gone, the app serves a
  cached shell showing the field pack — who's next, where, what's the
  job — with a clear "offline, saved at HH:MM" banner.
- An **outbox**: field actions performed offline are stored locally and
  synced automatically when signal returns.

Office work (creating quotes, invoice management, billing, settings,
team, exports) stays online-only — it happens at home or in the van with
signal, and keeping it server-side preserves every guarantee the audit
established.

## Phases

### Phase 0 — Idempotency (the duplicate-killer) — DO FIRST
Every mutating endpoint accepts a client-generated `request_id` (UUID).
New table `processed_requests (request_id pk, business_id, created_at)`;
the handler inserts it first — a conflict means this exact action already
ran, so return the previous outcome instead of acting twice.

This fixes the flaky-connection duplicate problem EVERYWHERE — online
double-taps included (the double-invoice bug from the review was this
class). It is also the prerequisite that makes sync safe: replaying an
outbox can never double-apply. Worth shipping even if nothing else here
gets built.

Scope: the write endpoints that matter (complete, notes, photos, create
job/quote, schedule, mark-paid, quick-book). Client components attach the
id; plain HTML forms get it as a hidden field generated server-side.

### Phase 1 — Field pack + offline viewing
- `/api/field-pack` returns the member's next 7 days (jobs they can see,
  per existing `canAccessJob`/assignment rules — a subcontractor's pack
  contains only their jobs, never the whole business).
- A client `FieldPackSync` component refreshes the pack in IndexedDB on
  every online page load (and on push-notification receipt).
- Service worker: precache an app-shell route `/field` (client-rendered
  from IndexedDB); network-first for normal pages with fallback to
  `/field` when offline. NO caching of normal pages — stale-data rule
  from CLAUDE.md stands; offline view is explicitly labelled.
- Offline banner + "saved at" timestamp. Online pages get a small "no
  connection" toast instead of dead buttons.
- **Not cached in v1: photos.** Text data only — keeps device storage
  tiny and the GDPR surface small.

### Phase 2 — Offline actions (outbox + sync)
Field actions only:
- **Complete job** (amount, note — photos come along if online, queue if
  not)
- **Add job note** (with photo, stored as a blob in the outbox)
- **Job photos** (before/after, queued as blobs)

Mechanics:
- Outbox rows in IndexedDB: `{request_id, action, payload, blobs,
  created_at, status}`.
- Sync runs on the `online` event + Background Sync where supported +
  app-open. Strict FIFO per job; each call carries its `request_id`.
- Completing a job offline queues the completion; the invoice + email
  are generated server-side at sync. UI says exactly that: "Saved -
  invoice will send when you're back online." No pretending.
- Conflicts: server wins. A queued action rejected by the server (job
  deleted meanwhile, permission changed) lands in a visible "needs
  attention" list — never silently dropped, never silently forced.
- Session expiry at sync time: outbox held, banner asks to log in, sync
  resumes after.

### Phase 3 — Hardening, GDPR, verification
- **Device data protection:** pack + outbox cleared on logout and on
  session-version bump (the password-change kill switch already exists);
  pack capped at 7 days; photos leave the device once synced. Privacy
  policy gains a "data stored on your device" section.
- **Tests:** extend `scripts/isolation-test.mjs` — one member's field
  pack must never contain another business's (or unassigned) jobs; replay
  the same request_id twice and prove one write; airplane-mode manual
  script for the phone.
- iOS reality: installed-PWA storage is stable; Safari-tab storage can be
  evicted after ~7 days unused. The install banner already pushes
  installation; offline docs say "install for reliable offline".

## What will genuinely NOT work offline (and never will)
Sending email, payment status, creating new customers/quotes (needs
duplicate-checks against the server), billing. The UI must say so
plainly rather than spin.

## Order of build
0 → 1 → 2 → 3, each phase deployed and tested before the next. Phase 0
and 1 are modest, self-contained wins. Phase 2 is the big one — most of
the engineering risk lives there, which is why it sits on top of proven
idempotency rather than being built first.
