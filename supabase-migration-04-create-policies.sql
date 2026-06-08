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
