-- Migration: Scorecard semantics + stop using snapshots
-- This migration introduces eden_user_scorecards as the only persisted artifact
-- for Prime Scorecard and removes snapshot_id from eden_user_state.

-- 1. Create eden_user_scorecards table
create table if not exists public.eden_user_scorecards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The persisted Prime Scorecard object
  scorecard_json jsonb not null,

  -- When the scorecard was computed (usually max(measured_at) from evidence, or now())
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Index for efficient lookups
create index if not exists idx_eden_user_scorecards_user_generated
  on public.eden_user_scorecards (user_id, generated_at desc);

-- Enable RLS
alter table public.eden_user_scorecards enable row level security;

-- RLS policy
drop policy if exists "Users can manage their own eden_user_scorecards" on public.eden_user_scorecards;
create policy "Users can manage their own eden_user_scorecards"
on public.eden_user_scorecards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 2. Update eden_user_state to use scorecard_id instead of snapshot_id
alter table public.eden_user_state
  drop column if exists latest_snapshot_id;

alter table public.eden_user_state
  add column if not exists latest_scorecard_id uuid references public.eden_user_scorecards(id);

