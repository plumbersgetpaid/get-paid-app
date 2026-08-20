-- Atomic login/reset throttle counter.
--
-- Replaces the JS select-then-upsert in app/lib/loginThrottle.js, which
-- was a read-modify-write: a burst of parallel password guesses all read
-- the same low count and their writes overwrote each other, so the counter
-- never reached the lockout threshold. This does the whole increment under
-- the row lock that INSERT ... ON CONFLICT DO UPDATE takes, so N parallel
-- calls produce N, not 1.
--
-- The `ip` column now stores a scoped key ("login:1.2.3.4" / "reset:1.2.3.4")
-- so login and password-reset have independent counters.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.

create or replace function record_login_attempt(
  p_key text,
  p_window_ms bigint,
  p_max_attempts int,
  p_lockout_ms bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := (p_window_ms || ' milliseconds')::interval;
  v_attempts int;
begin
  insert into login_attempts (ip, attempts, window_started_at, locked_until)
  values (p_key, 1, v_now, null)
  on conflict (ip) do update set
    attempts = case
      when v_now - login_attempts.window_started_at < v_window
        then login_attempts.attempts + 1
      else 1
    end,
    window_started_at = case
      when v_now - login_attempts.window_started_at < v_window
        then login_attempts.window_started_at
      else v_now
    end
  returning attempts into v_attempts;

  if v_attempts >= p_max_attempts then
    update login_attempts
      set locked_until = v_now + (p_lockout_ms || ' milliseconds')::interval
      where ip = p_key;
  end if;

  -- Self-purge: don't retain IP addresses indefinitely (UK GDPR). Drop rows
  -- older than a day that aren't currently locked. Cheap; runs on each fail.
  delete from login_attempts
    where window_started_at < v_now - interval '24 hours'
      and (locked_until is null or locked_until < v_now);
end;
$$;
