-- voice/ — audio recordings for Whisper transcription (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice',
  'voice',
  false,
  26214400, -- 25 MB
  array['audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/webm','video/mp4']
);

-- media/ — reporter photos and videos (private, served via signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  104857600, -- 100 MB
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']
);

-- Storage RLS: reporters can upload, admins can read
create policy "reporter_upload_media" on storage.objects
  for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');

create policy "reporter_upload_voice" on storage.objects
  for insert
  with check (bucket_id = 'voice' and auth.role() = 'authenticated');

create policy "admin_read_all_storage" on storage.objects
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Service role (worker) has full access via bypass RLS
