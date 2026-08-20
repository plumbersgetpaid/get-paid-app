-- ---------------------------------------------------------------------
-- Web push subscriptions (Aug 2026). Run once in the Supabase SQL editor.
-- ---------------------------------------------------------------------
-- One row per device a team member has enabled notifications on. Endpoint
-- is unique - a device re-subscribing upserts rather than duplicating.
create table if not exists push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null,
  team_member_id uuid not null,
  endpoint       text not null unique,
  p256dh         text not null,
  auth           text not null,
  created_at     timestamptz not null default now()
);

create index if not exists push_subscriptions_member_idx on push_subscriptions (team_member_id);

-- Service-role only, consistent with the audit's rule for tables the app
-- touches solely through the admin client.
alter table push_subscriptions enable row level security;
