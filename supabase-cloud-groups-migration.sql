-- Destin Flow cloud sharing migration.
-- Run this in Supabase SQL editor if you already ran supabase-schema.sql before.

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

drop policy if exists "cloud_snapshots_select_self" on public.cloud_snapshots;
drop policy if exists "cloud_snapshots_insert_self" on public.cloud_snapshots;
drop policy if exists "cloud_snapshots_update_self" on public.cloud_snapshots;
drop policy if exists "cloud_groups_select_admin_or_invited" on public.cloud_groups;
drop policy if exists "cloud_groups_insert_admin" on public.cloud_groups;
drop policy if exists "cloud_groups_update_admin" on public.cloud_groups;
drop policy if exists "cloud_groups_delete_admin" on public.cloud_groups;
drop policy if exists "cloud_group_access_select_related" on public.cloud_group_access;
drop policy if exists "cloud_group_access_insert_admin" on public.cloud_group_access;
drop policy if exists "cloud_group_access_update_admin_or_self" on public.cloud_group_access;
drop policy if exists "cloud_group_access_delete_admin" on public.cloud_group_access;
drop policy if exists "cloud_expenses_select_group" on public.cloud_expenses;
drop policy if exists "cloud_expenses_insert_group_writer" on public.cloud_expenses;
drop policy if exists "cloud_expenses_update_group_writer" on public.cloud_expenses;
drop policy if exists "cloud_expenses_delete_group_admin" on public.cloud_expenses;

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
