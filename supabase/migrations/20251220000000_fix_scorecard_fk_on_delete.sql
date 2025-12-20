-- Migration: Fix latest_scorecard_id FK to allow cascade on delete
-- When a scorecard is deleted, set latest_scorecard_id to NULL instead of blocking

-- Drop the existing foreign key constraint
ALTER TABLE public.eden_user_state
  DROP CONSTRAINT IF EXISTS eden_user_state_latest_scorecard_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE public.eden_user_state
  ADD CONSTRAINT eden_user_state_latest_scorecard_id_fkey
  FOREIGN KEY (latest_scorecard_id)
  REFERENCES public.eden_user_scorecards(id)
  ON DELETE SET NULL;

