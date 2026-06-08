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
