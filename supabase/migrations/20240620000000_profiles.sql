create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  display_name text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  bio text not null default '',
  preferred_units text not null default 'imperial'
    check (preferred_units in ('imperial', 'metric')),
  receive_friend_requests boolean not null default true,
  receive_convoy_updates boolean not null default true,
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'interceptor', 'commander')),
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_clerk_user_id_idx
  on public.profiles (clerk_user_id);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;
