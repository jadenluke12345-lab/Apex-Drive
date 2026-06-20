create table if not exists public.route_submissions (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  submitter_name text not null default '',
  submitter_email text not null default '',
  name text not null,
  start_label text not null,
  end_label text not null,
  notes text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists route_submissions_status_idx
  on public.route_submissions (status);

create index if not exists route_submissions_clerk_user_id_idx
  on public.route_submissions (clerk_user_id);

create index if not exists route_submissions_created_at_idx
  on public.route_submissions (created_at desc);

create or replace function public.set_route_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists route_submissions_set_updated_at on public.route_submissions;

create trigger route_submissions_set_updated_at
before update on public.route_submissions
for each row
execute function public.set_route_submissions_updated_at();

alter table public.route_submissions enable row level security;
