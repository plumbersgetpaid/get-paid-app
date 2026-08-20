-- "Ask PatchUp" help assistant — question log.
--
-- Every question a user asks the in-app help box is stored here as product
-- feedback (what confuses people is the roadmap). Scoped by business_id so it's
-- covered by the 30-day deletion. Service-role only, per the audit's rule.
--
-- Run once in the Supabase SQL editor. It also re-defines delete_business_data()
-- to include this table, so run the WHOLE file.

create table if not exists help_questions (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null,
  team_member_id uuid,
  question       text not null,
  answer         text,
  created_at     timestamptz not null default now()
);

create index if not exists help_questions_business_idx on help_questions (business_id, created_at desc);

alter table help_questions enable row level security;

-- Restated deletion function with help_questions added (keeps the 30-day
-- deletion complete — same as supabase/idempotency.sql plus one line).
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
  delete from help_questions       where business_id = p_business_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('help_questions', n);
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
