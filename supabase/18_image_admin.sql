-- Lets admins overwrite/delete existing objects in the image buckets so the
-- one-time recompression tool (Admin -> optimize images) can shrink files
-- that were uploaded before client-side compression existed.
drop policy if exists "admin update images" on storage.objects;
create policy "admin update images" on storage.objects for update to authenticated
  using (bucket_id in ('item-images','avatars','streamer-covers') and public.is_admin())
  with check (bucket_id in ('item-images','avatars','streamer-covers') and public.is_admin());

drop policy if exists "admin delete images" on storage.objects;
create policy "admin delete images" on storage.objects for delete to authenticated
  using (bucket_id in ('item-images','avatars','streamer-covers') and public.is_admin());
