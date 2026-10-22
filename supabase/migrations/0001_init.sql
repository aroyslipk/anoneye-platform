-- Anoneye initial schema
-- Postgres / Supabase. Apply with `supabase db push` or the SQL editor.
--
-- Security model:
--   * every app row carries owner_id = auth.uid()
--   * RLS is enabled on every table that holds user data
--   * OAuth ciphertext lives in a separate table with NO client policies;
--     it is only readable through the service role (cron + connected accounts)
--
-- Columns intentionally use `*_count` names: a NULL means "the provider did
-- not return this metric", while 0 is a genuine zero.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Updated-at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (app-level settings; credentials stay in auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'bn' check (locale in ('bn', 'en')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- connected_accounts + secrets
-- ---------------------------------------------------------------------------
create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook')),
  provider_account_id text not null,
  display_name text,
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked')),
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, platform, provider_account_id)
);

create index if not exists connected_accounts_owner_idx on public.connected_accounts(owner_id);

create trigger connected_accounts_updated_at before update on public.connected_accounts
  for each row execute function public.set_updated_at();

alter table public.connected_accounts enable row level security;

create policy "connected_accounts_select_own" on public.connected_accounts
  for select using (auth.uid() = owner_id);
create policy "connected_accounts_insert_own" on public.connected_accounts
  for insert with check (auth.uid() = owner_id);
create policy "connected_accounts_update_own" on public.connected_accounts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "connected_accounts_delete_own" on public.connected_accounts
  for delete using (auth.uid() = owner_id);

-- Ciphertext: service-role only. No policies are created on purpose.
create table if not exists public.connected_account_secrets (
  account_id uuid primary key references public.connected_accounts(id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.connected_account_secrets enable row level security;

-- ---------------------------------------------------------------------------
-- tracked_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.tracked_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook')),
  identifier text not null check (char_length(identifier) between 1 and 200),
  canonical_url text not null,
  label text check (char_length(label) <= 80),
  monitoring_status text not null default 'active' check (monitoring_status in ('active', 'paused')),
  last_synced_at timestamptz,
  last_sync_status text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, platform, identifier)
);

create index if not exists tracked_profiles_owner_idx on public.tracked_profiles(owner_id, updated_at desc);
create index if not exists tracked_profiles_due_idx on public.tracked_profiles(monitoring_status, last_synced_at);

create trigger tracked_profiles_updated_at before update on public.tracked_profiles
  for each row execute function public.set_updated_at();

alter table public.tracked_profiles enable row level security;

create policy "tracked_profiles_select_own" on public.tracked_profiles
  for select using (auth.uid() = owner_id);
create policy "tracked_profiles_insert_own" on public.tracked_profiles
  for insert with check (auth.uid() = owner_id);
create policy "tracked_profiles_update_own" on public.tracked_profiles
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "tracked_profiles_delete_own" on public.tracked_profiles
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- sync_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tracked_profile_id uuid not null references public.tracked_profiles(id) on delete cascade,
  status text not null check (status in ('running', 'succeeded', 'failed', 'retry_scheduled', 'failed_permanent')),
  started_at timestamptz not null,
  completed_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  next_attempt_at timestamptz,
  error_code text,
  safe_error text,
  created_at timestamptz not null default now()
);

create index if not exists sync_jobs_owner_idx on public.sync_jobs(owner_id, started_at desc);
create index if not exists sync_jobs_tracked_idx on public.sync_jobs(tracked_profile_id, started_at desc);
create index if not exists sync_jobs_retry_idx on public.sync_jobs(status, next_attempt_at);

alter table public.sync_jobs enable row level security;

create policy "sync_jobs_select_own" on public.sync_jobs
  for select using (auth.uid() = owner_id);
create policy "sync_jobs_insert_own" on public.sync_jobs
  for insert with check (auth.uid() = owner_id);
create policy "sync_jobs_update_own" on public.sync_jobs
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "sync_jobs_delete_own" on public.sync_jobs
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- metric_snapshots (one genuine observation per successful sync)
-- ---------------------------------------------------------------------------
create table if not exists public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tracked_profile_id uuid not null references public.tracked_profiles(id) on delete cascade,
  observed_at timestamptz not null,
  followers_count integer check (followers_count is null or followers_count >= 0),
  following_count integer check (following_count is null or following_count >= 0),
  media_count integer check (media_count is null or media_count >= 0),
  source text not null,
  sync_job_id uuid references public.sync_jobs(id) on delete set null,
  sync_status text not null default 'success' check (sync_status = 'success'),
  created_at timestamptz not null default now()
);

create index if not exists metric_snapshots_tracked_idx on public.metric_snapshots(tracked_profile_id, observed_at);
create index if not exists metric_snapshots_owner_idx on public.metric_snapshots(owner_id, observed_at);

alter table public.metric_snapshots enable row level security;

create policy "metric_snapshots_select_own" on public.metric_snapshots
  for select using (auth.uid() = owner_id);
create policy "metric_snapshots_insert_own" on public.metric_snapshots
  for insert with check (auth.uid() = owner_id);
create policy "metric_snapshots_delete_own" on public.metric_snapshots
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- media_items (metadata only; media files are never stored by Anoneye)
-- ---------------------------------------------------------------------------
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tracked_profile_id uuid not null references public.tracked_profiles(id) on delete cascade,
  provider_media_id text not null,
  media_type text not null check (media_type in ('image', 'video', 'carousel', 'unknown')),
  published_at timestamptz,
  source_url text,
  thumbnail_url text,
  permalink text,
  caption text,
  like_count integer,
  comments_count integer,
  retrieval_status text not null check (retrieval_status in ('listed', 'unavailable', 'expired')),
  fetched_at timestamptz not null default now(),
  unique (tracked_profile_id, provider_media_id)
);

create index if not exists media_items_tracked_idx on public.media_items(tracked_profile_id, published_at desc);

alter table public.media_items enable row level security;

create policy "media_items_select_own" on public.media_items
  for select using (auth.uid() = owner_id);
create policy "media_items_insert_own" on public.media_items
  for insert with check (auth.uid() = owner_id);
create policy "media_items_update_own" on public.media_items
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "media_items_delete_own" on public.media_items
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- reports (CSV audit rows)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tracked_profile_id uuid references public.tracked_profiles(id) on delete set null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  generated_at timestamptz not null default now(),
  row_count integer not null default 0 check (row_count >= 0),
  format text not null default 'csv' check (format = 'csv')
);

create index if not exists reports_owner_idx on public.reports(owner_id, generated_at desc);

alter table public.reports enable row level security;

create policy "reports_select_own" on public.reports
  for select using (auth.uid() = owner_id);
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = owner_id);
create policy "reports_delete_own" on public.reports
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- contact_messages: written only through the service role (no client access)
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) <= 254),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- ---------------------------------------------------------------------------
-- Latest observation per tracked profile (used by listTracked/getDashboard).
-- security_invoker keeps the caller's RLS context.
-- ---------------------------------------------------------------------------
create or replace view public.tracked_profiles_latest
with (security_invoker = true) as
select
  t.id,
  t.owner_id,
  t.platform,
  t.identifier,
  t.canonical_url,
  t.label,
  t.monitoring_status,
  t.last_synced_at,
  t.last_sync_status,
  t.last_error_code,
  t.created_at,
  t.updated_at,
  s.observed_at  as latest_observed_at,
  s.followers_count as latest_followers,
  s.following_count as latest_following,
  s.media_count  as latest_media_count,
  s.source       as latest_source
from public.tracked_profiles t
left join lateral (
  select observed_at, followers_count, following_count, media_count, source
  from public.metric_snapshots m
  where m.tracked_profile_id = t.id
  order by m.observed_at desc
  limit 1
) s on true;

grant select on public.tracked_profiles_latest to authenticated;

-- ---------------------------------------------------------------------------
-- Storage of auth tokens: revoke direct client access explicitly.
-- ---------------------------------------------------------------------------
revoke all on public.connected_account_secrets from anon, authenticated;
revoke all on public.contact_messages from anon, authenticated;
