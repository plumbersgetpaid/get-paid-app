-- ---------------------------------------------------------------------
-- Idempotency (Phase 0 of the offline plan). Run once in the SQL editor.
-- ---------------------------------------------------------------------
-- One row per processed action. The client (form or fetch component)
-- generates a request_id; the server inserts it here before acting. A
-- retry of the same action - flaky signal, double-tap, browser resubmit,
-- offline outbox replay - hits the primary key and is answered with the
-- success response instead of being executed twice.
create table if not exists processed_requests (
  request_id  uuid primary key,
  business_id uuid not null,
  endpoint    text not null,
  created_at  timestamptz not null default now()
);

-- Service-role only, per the audit's rule.
alter table processed_requests enable row level security;

-- Rows only need to outlive a retry window; the delete-cancelled cron
-- purges anything older than 30 days nightly.

-- Keep the 30-day deletion complete: this table carries business_id, so
-- CLAUDE.md's rule applies. Restated function with one added line.
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
  delete from push_subscriptions   where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('push_subscriptions', n);
  delete from processed_requests   where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('processed_requests', n);
  delete from team_members         where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('team_members', n);

  return counts;
end;
$$;

revoke all on function delete_business_data(uuid) from public, anon, authenticated;
