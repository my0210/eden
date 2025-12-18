-- 0) Extend apple_health_imports to support first-class lifecycle
alter table public.apple_health_imports
  add column if not exists source text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists error_message text,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

-- optional: normalize old status names
update public.apple_health_imports
set status = 'uploaded',
    uploaded_at = coalesce(uploaded_at, created_at)
where status = 'pending';

-- 1) Photo uploads table
create table if not exists public.eden_photo_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  kind text not null default 'body_photo', -- future: 'meal_photo', etc.
  file_path text not null,                -- path in Supabase Storage
  file_size bigint null,
  mime_type text null,

  status text not null default 'uploaded', -- uploaded|processing|completed|failed
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  failed_at timestamptz null,
  error_message text null,

  metadata_json jsonb not null default '{}'::jsonb
);

alter table public.eden_photo_uploads enable row level security;

drop policy if exists "Users can manage their own eden_photo_uploads" on public.eden_photo_uploads;
create policy "Users can manage their own eden_photo_uploads"
on public.eden_photo_uploads
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Add indexes for common queries
create index if not exists idx_eden_photo_uploads_user_id on public.eden_photo_uploads(user_id);
create index if not exists idx_eden_photo_uploads_status on public.eden_photo_uploads(status);
create index if not exists idx_eden_photo_uploads_created_at on public.eden_photo_uploads(created_at desc);


