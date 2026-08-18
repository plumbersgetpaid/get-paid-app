-- ---------------------------------------------------------------------
-- Security hardening (Aug 2026): session invalidation + login throttle.
-- Run once in the Supabase SQL editor.
-- ---------------------------------------------------------------------

-- 1. session_version: bumped on every password change so existing session
-- tokens stop verifying. Session tokens are stateless HMACs that otherwise
-- stay valid for 30 days regardless of a password reset, so a stolen
-- cookie survived the very action meant to fix a compromise. The token now
-- carries this number; a mismatch against the row means "log in again".
alter table team_members add column if not exists session_version integer not null default 0;

-- 2. login_attempts: per-IP failed-login counter behind the login and
-- forgot-password endpoints. Keyed on IP, not email, on purpose - an
-- email-keyed lockout lets an attacker lock a real tradesperson out by
-- spamming their address (their email is on every invoice they send).
create table if not exists login_attempts (
  ip               text primary key,
  attempts         integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until     timestamptz
);

-- Service-role only. RLS on with no policy denies the anon key entirely,
-- consistent with the audit's rule for tables the app touches only through
-- the admin client.
alter table login_attempts enable row level security;
