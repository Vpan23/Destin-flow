create extension if not exists "pgcrypto";

create table if not exists public.cloud_snapshots (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_groups (
  id uuid primary key default gen_random_uuid(),
  local_group_id text not null,
  name text not null,
  type text not null default 'otro',
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  join_token text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(admin_user_id, local_group_id)
);

alter table public.cloud_groups
  add column if not exists join_token text;

update public.cloud_groups
set join_token = encode(gen_random_bytes(16), 'hex')
where join_token is null;

alter table public.cloud_groups
  alter column join_token set default encode(gen_random_bytes(16), 'hex');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cloud_groups_join_token_key'
  ) then
    alter table public.cloud_groups
      add constraint cloud_groups_join_token_key unique (join_token);
  end if;
end $$;

create table if not exists public.cloud_group_access (
  id uuid primary key default gen_random_uuid(),
  cloud_group_id uuid not null references public.cloud_groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  role text not null default 'miembro',
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  unique(cloud_group_id, email)
);

create table if not exists public.cloud_expenses (
  id uuid primary key default gen_random_uuid(),
  cloud_group_id uuid not null references public.cloud_groups(id) on delete cascade,
  local_group_id text not null,
  local_expense_id text not null,
  payload jsonb not null,
  deleted boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(cloud_group_id, local_expense_id)
);

alter table public.cloud_snapshots enable row level security;
alter table public.cloud_groups enable row level security;
alter table public.cloud_group_access enable row level security;
alter table public.cloud_expenses enable row level security;
