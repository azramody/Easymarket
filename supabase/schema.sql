-- easymarket database schema. Paste into Supabase → SQL Editor → Run.
-- Safe to re-run.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  voice text not null default 'af_heart',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.topic_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text not null,
  enabled boolean not null default true,
  difficulty text not null default 'basic' check (difficulty in ('basic', 'intermediate', 'advanced')),
  frequency text not null default 'daily' check (frequency in ('daily', 'weekdays', 'weekly')),
  weekly_day smallint not null default 6 check (weekly_day between 0 and 6), -- 0 = Monday
  custom_notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_date date not null,
  kind text not null check (kind in ('daily', 'extended')),
  title text not null,
  audio_path text,
  duration_sec real not null default 0,
  topic_ids text[] not null default '{}',
  chapters jsonb not null default '[]',
  transcript text not null default '',
  show_notes jsonb not null default '{}',
  sources jsonb not null default '[]',
  created_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(transcript, ''))) stored,
  unique (user_id, episode_date)
);
create index if not exists episodes_search_idx on public.episodes using gin (search);
create index if not exists episodes_user_date_idx on public.episodes (user_id, episode_date desc);

-- Latest official data, written nightly; Lily reads it to answer market questions.
create table if not exists public.market_snapshots (
  as_of date primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.topic_prefs enable row level security;
alter table public.episodes enable row level security;
alter table public.market_snapshots enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own prefs" on public.topic_prefs;
create policy "own prefs" on public.topic_prefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read own episodes" on public.episodes;
create policy "read own episodes" on public.episodes for select using (auth.uid() = user_id);

drop policy if exists "read snapshots" on public.market_snapshots;
create policy "read snapshots" on public.market_snapshots for select to authenticated using (true);

-- Private audio bucket; each user can read only their own folder (<user_id>/<date>.mp3).
insert into storage.buckets (id, name, public) values ('episodes', 'episodes', false)
on conflict (id) do nothing;

drop policy if exists "read own audio" on storage.objects;
create policy "read own audio" on storage.objects for select to authenticated
  using (bucket_id = 'episodes' and (storage.foldername(name))[1] = auth.uid()::text);
