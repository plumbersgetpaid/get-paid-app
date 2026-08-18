-- ---------------------------------------------------------------------
-- Close direct anon-key access found in the Aug 2026 audit.
-- Run once in the Supabase SQL editor.
-- ---------------------------------------------------------------------

-- THE BIG ONE. Postgres views execute with their owner's privileges by
-- default, so row-level security on invoices/customers never applied to
-- this view - it returned every business's unpaid invoices (customer
-- names, phones, emails, amounts) to the bare anon key, which ships in
-- the browser bundle. security_invoker makes the view run as whoever
-- queries it: the service role still sees everything (it bypasses RLS),
-- the anon key sees nothing.
alter view outstanding_invoices set (security_invoker = true);

-- These three tables never had RLS enabled at all, so the anon key could
-- read them raw: every business name, and every Stripe customer id,
-- subscription id, seat count and cancellation date on the platform.
-- Enabling RLS with no policies denies everything except the service
-- role - correct, because the app only ever reads these through the
-- admin client (verified: no scoped or browser reads anywhere).
alter table businesses enable row level security;
alter table subscriptions enable row level security;
alter table platform_settings enable row level security;
