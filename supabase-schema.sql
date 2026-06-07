-- Destin Flow cloud schema for Supabase/Postgres.
-- Run this in the Supabase SQL editor after creating a project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'familia',
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null default 'USD',
  control_month text not null,
  monthly_family_budget numeric not null default 0,
  monthly_business_budget numeric not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  role text not null default 'miembro',
  color text not null default '#1f7a4d',
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  unique(group_id, email)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'miembro',
  token text not null unique,
  status text not null default 'pendiente',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  type text not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique(group_id, type, name)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  type text not null,
  owner_member_id uuid references public.group_members(id) on delete set null,
  monthly_limit numeric,
  shared boolean not null default false,
  allowed_member_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  type text not null,
  currency text not null default 'USD',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  type text not null,
  amount numeric not null,
  expense_date date not null,
  registered_at timestamptz not null default now(),
  member_id uuid references public.group_members(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  category text not null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  description text,
  vendor text,
  responsible text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

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
  join_token text not null default encode(gen_random_bytes(16), 'hex') unique,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(admin_user_id, local_group_id)
);

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

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invitations enable row level security;
alter table public.categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.businesses enable row level security;
alter table public.expenses enable row level security;
alter table public.activity_logs enable row level security;
alter table public.cloud_snapshots enable row level security;
alter table public.cloud_groups enable row level security;
alter table public.cloud_group_access enable row level security;
alter table public.cloud_expenses enable row level security;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and status = 'activo'
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = target_group_id
      and admin_user_id = auth.uid()
  )
  or exists (
    select 1 from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and role = 'admin'
      and status = 'activo'
  );
$$;

create or replace function public.is_cloud_group_admin(target_cloud_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cloud_groups
    where id = target_cloud_group_id
      and admin_user_id = auth.uid()
  );
$$;

create or replace function public.can_access_cloud_group(target_cloud_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_cloud_group_admin(target_cloud_group_id)
  or exists (
    select 1 from public.cloud_group_access
    where cloud_group_id = target_cloud_group_id
      and email = (auth.jwt() ->> 'email')
      and status = 'activo'
  );
$$;

create or replace function public.can_write_cloud_group(target_cloud_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_cloud_group_admin(target_cloud_group_id)
  or exists (
    select 1 from public.cloud_group_access
    where cloud_group_id = target_cloud_group_id
      and email = (auth.jwt() ->> 'email')
      and status = 'activo'
      and role in ('admin', 'miembro')
  );
$$;

create or replace function public.join_cloud_group_by_token(target_join_token text)
returns table (
  id uuid,
  name text,
  type text,
  payload jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_group public.cloud_groups%rowtype;
  user_email text;
begin
  user_email := auth.jwt() ->> 'email';
  if auth.uid() is null or user_email is null then
    raise exception 'Debes iniciar sesion para unirte al grupo.';
  end if;

  select *
  into matched_group
  from public.cloud_groups
  where join_token = target_join_token;

  if matched_group.id is null then
    raise exception 'Link de grupo invalido o expirado.';
  end if;

  insert into public.cloud_group_access (cloud_group_id, user_id, email, role, status)
  values (matched_group.id, auth.uid(), lower(user_email), 'miembro', 'activo')
  on conflict (cloud_group_id, email)
  do update set
    user_id = excluded.user_id,
    status = 'activo';

  return query
  select
    matched_group.id,
    matched_group.name,
    matched_group.type,
    matched_group.payload,
    matched_group.updated_at;
end;
$$;

create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id));

create policy "groups_insert_auth" on public.groups
  for insert with check (admin_user_id = auth.uid());

create policy "groups_update_admin" on public.groups
  for update using (public.is_group_admin(id));

create policy "groups_delete_admin" on public.groups
  for delete using (public.is_group_admin(id));

create policy "members_select_group" on public.group_members
  for select using (public.is_group_member(group_id));

create policy "members_insert_admin" on public.group_members
  for insert with check (public.is_group_admin(group_id) or user_id = auth.uid());

create policy "members_update_admin" on public.group_members
  for update using (public.is_group_admin(group_id));

create policy "members_delete_admin" on public.group_members
  for delete using (public.is_group_admin(group_id));

create policy "invitations_select_admin_or_invited" on public.invitations
  for select using (public.is_group_admin(group_id) or email = (auth.jwt() ->> 'email'));

create policy "invitations_manage_admin" on public.invitations
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "categories_member_all" on public.categories
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "payment_methods_member_all" on public.payment_methods
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "businesses_member_all" on public.businesses
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "expenses_member_all" on public.expenses
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "activity_member_select" on public.activity_logs
  for select using (public.is_group_member(group_id));

create policy "activity_member_insert" on public.activity_logs
  for insert with check (public.is_group_member(group_id));

create policy "cloud_snapshots_select_self" on public.cloud_snapshots
  for select using (auth.uid() = user_id);

create policy "cloud_snapshots_insert_self" on public.cloud_snapshots
  for insert with check (auth.uid() = user_id);

create policy "cloud_snapshots_update_self" on public.cloud_snapshots
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "cloud_groups_select_admin_or_invited" on public.cloud_groups
  for select using (public.can_access_cloud_group(id));

create policy "cloud_groups_insert_admin" on public.cloud_groups
  for insert with check (admin_user_id = auth.uid());

create policy "cloud_groups_update_admin" on public.cloud_groups
  for update using (public.can_write_cloud_group(id))
  with check (public.can_write_cloud_group(id));

create policy "cloud_groups_delete_admin" on public.cloud_groups
  for delete using (public.is_cloud_group_admin(id));

create policy "cloud_group_access_select_related" on public.cloud_group_access
  for select using (
    email = (auth.jwt() ->> 'email')
    or public.is_cloud_group_admin(cloud_group_id)
  );

create policy "cloud_group_access_insert_admin" on public.cloud_group_access
  for insert with check (public.is_cloud_group_admin(cloud_group_id));

create policy "cloud_group_access_update_admin_or_self" on public.cloud_group_access
  for update using (
    email = (auth.jwt() ->> 'email')
    or public.is_cloud_group_admin(cloud_group_id)
  )
  with check (
    email = (auth.jwt() ->> 'email')
    or public.is_cloud_group_admin(cloud_group_id)
  );

create policy "cloud_group_access_delete_admin" on public.cloud_group_access
  for delete using (public.is_cloud_group_admin(cloud_group_id));

create policy "cloud_expenses_select_group" on public.cloud_expenses
  for select using (public.can_access_cloud_group(cloud_group_id));

create policy "cloud_expenses_insert_group_writer" on public.cloud_expenses
  for insert with check (public.can_write_cloud_group(cloud_group_id));

create policy "cloud_expenses_update_group_writer" on public.cloud_expenses
  for update using (public.can_write_cloud_group(cloud_group_id))
  with check (public.can_write_cloud_group(cloud_group_id));

create policy "cloud_expenses_delete_group_admin" on public.cloud_expenses
  for delete using (public.is_cloud_group_admin(cloud_group_id));

alter table public.cloud_groups replica identity full;
alter table public.cloud_expenses replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cloud_groups'
  ) then
    alter publication supabase_realtime add table public.cloud_groups;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cloud_expenses'
  ) then
    alter publication supabase_realtime add table public.cloud_expenses;
  end if;
end $$;
