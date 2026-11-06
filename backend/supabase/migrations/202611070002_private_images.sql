begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('daily-images','daily-images',false,5242880,array['image/jpeg','image/png','image/webp','image/avif']);
create policy daily_images_select on storage.objects for select to authenticated
 using (bucket_id='daily-images' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.daily_members m where m.user_id=(select auth.uid()) and m.active));
create policy daily_images_insert on storage.objects for insert to authenticated
 with check (bucket_id='daily-images' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.daily_members m where m.user_id=(select auth.uid()) and m.active));
create policy daily_images_update on storage.objects for update to authenticated
 using (bucket_id='daily-images' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.daily_members m where m.user_id=(select auth.uid()) and m.active))
 with check (bucket_id='daily-images' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.daily_members m where m.user_id=(select auth.uid()) and m.active));
create policy daily_images_delete on storage.objects for delete to authenticated
 using (bucket_id='daily-images' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.daily_members m where m.user_id=(select auth.uid()) and m.active));
insert into daily_private.schema_migrations(version) values('202611070002_private_images');
commit;
