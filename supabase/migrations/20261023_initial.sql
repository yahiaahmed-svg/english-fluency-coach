-- English Fluency Coach Pro — Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  current_level text default 'B1',
  daily_goal integer default 20,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sentence_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  sentence_id text not null,
  status text default 'learning',
  ease numeric default 2.5,
  interval_days numeric default 0,
  repetitions integer default 0,
  due_at timestamptz default now(),
  last_result text,
  updated_at timestamptz default now(),
  primary key (user_id, sentence_id)
);
create index if not exists sentence_progress_due_idx on public.sentence_progress(user_id,due_at);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  sentence_id text not null,
  created_at timestamptz default now(),
  primary key(user_id,sentence_id)
);

create table if not exists public.daily_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  learned integer default 0,
  reviewed integer default 0,
  speaking_attempts integer default 0,
  xp integer default 0,
  primary key(user_id,date)
);

create table if not exists public.ai_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  scenario text,
  user_text text,
  assistant_json jsonb,
  created_at timestamptz default now()
);

create table if not exists public.pronunciation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_text text not null,
  transcript text,
  match_score integer,
  feedback_json jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.sentence_progress enable row level security;
alter table public.favorites enable row level security;
alter table public.daily_stats enable row level security;
alter table public.ai_history enable row level security;
alter table public.pronunciation_attempts enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "progress own rows" on public.sentence_progress;
create policy "progress own rows" on public.sentence_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "favorites own rows" on public.favorites;
create policy "favorites own rows" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "daily own rows" on public.daily_stats;
create policy "daily own rows" on public.daily_stats for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ai own rows" on public.ai_history;
create policy "ai own rows" on public.ai_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "pronunciation own rows" on public.pronunciation_attempts;
create policy "pronunciation own rows" on public.pronunciation_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name',''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
