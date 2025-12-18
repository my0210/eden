-- Storage policies for body_photos bucket
-- Note: The bucket itself must be created in the Supabase UI (Storage → Create bucket: body_photos, private)

-- Allow authenticated users to upload/read only within a userId/ prefix.
-- Convention: object key = `${user_id}/${uuid}.${ext}`

create policy if not exists "body_photos read own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'body_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy if not exists "body_photos insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'body_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy if not exists "body_photos update own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'body_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'body_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy if not exists "body_photos delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'body_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);


