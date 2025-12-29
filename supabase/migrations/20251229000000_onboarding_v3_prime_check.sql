-- Migration: Onboarding v3 - Add prime_check_json for Prime Check step
-- This migration adds the prime_check_json column to eden_user_state
-- to store answers from the Prime Check onboarding step (Step 5).

-- Add prime_check_json column to eden_user_state
-- This stores all Prime Check answers with schema versioning
alter table public.eden_user_state
  add column if not exists prime_check_json jsonb;

-- Add comment for documentation
comment on column public.eden_user_state.prime_check_json is 
  'Prime Check onboarding answers (v3). Contains quick checks, measurements, and labs per domain. Includes schema_version for migration safety.';

