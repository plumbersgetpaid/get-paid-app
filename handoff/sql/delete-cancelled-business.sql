-- ---------------------------------------------------------------------
-- 30-day deletion after cancellation
--
-- Run this once in the Supabase SQL editor. It adds the cancellation
-- timestamp the clock hangs off, and the function that does the deleting.
-- ---------------------------------------------------------------------

-- 1. When the account was cancelled.
--
-- The webhook already sets status = 'canceled' and touches updated_at,
-- but updated_at moves for any change at all - so using it as the clock
-- means an unrelated write silently restarts a 30-day countdown that
-- ends in permanent deletion. This column is written once and left alone.
alter table subscriptions add column if not exists canceled_at timestamptz;

-- Backfill anything already cancelled, so existing accounts aren't stuck
-- with no clock at all.
update subscriptions
   set canceled_at = updated_at
 where status = 'canceled'
   and canceled_at is null;


-- 2. The deletion itself.
--
-- One function, one transaction: either the whole account goes or none of
-- it does. Fifteen separate deletes issued from the application can fail
-- on the eighth and leave someone half-erased, with no clean way to
-- finish and no way back.
--
-- Order is dictated by the foreign keys, which are almost all NO ACTION -
-- nothing cascades from the business downwards, so children must go
-- before parents:
--
--   chase_log -> invoices -> jobs -> customers
--   jobs, job_notes, personal_events, recurring_jobs -> team_members
--
-- Deliberately kept: businesses (the name) and subscriptions (Stripe ids,
-- amounts, dates), which are the billing record retained for 6 years for
-- UK tax. Everything else - clients, jobs, invoices, photos, team,
-- settings - is deleted outright. No soft delete, no flag.
create or replace function delete_business_data(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  counts jsonb := '{}'::jsonb;
  n integer;
  sub_status text;
begin
  -- Refuse to touch an account that isn't actually cancelled. The caller
  -- checks this too; this is the backstop that means a bug in the caller
  -- can't erase a paying customer.
  select status into sub_status from subscriptions where business_id = p_business_id;

  if sub_status is null then
    raise exception 'No subscription for business %, refusing to delete', p_business_id;
  end if;

  if sub_status <> 'canceled' then
    raise exception 'Business % has status %, not canceled - refusing to delete',
      p_business_id, sub_status;
  end if;

  delete from chase_log            where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('chase_log', n);

  delete from invoices             where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('invoices', n);

  delete from job_notes            where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('job_notes', n);

  delete from job_photos           where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('job_photos', n);

  delete from job_shares           where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('job_shares', n);

  delete from jobs                 where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('jobs', n);

  delete from recurring_job_shares where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('recurring_job_shares', n);

  delete from recurring_jobs       where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('recurring_jobs', n);

  delete from reminder_shares      where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('reminder_shares', n);

  delete from personal_events      where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('personal_events', n);

  delete from ignored_duplicates   where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('ignored_duplicates', n);

  delete from customers            where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('customers', n);

  delete from message_templates    where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('message_templates', n);

  delete from business_settings    where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('business_settings', n);

  delete from team_members         where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('team_members', n);

  return counts;
end;
$$;

-- Only the service role should ever be able to call this.
revoke all on function delete_business_data(uuid) from public, anon, authenticated;
