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
