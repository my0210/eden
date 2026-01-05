-- Eden User Memory Table
-- Structured memory with confidence layers to prevent hallucination

CREATE TABLE eden_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Structured layers (JSONB for flexibility)
  confirmed JSONB NOT NULL DEFAULT '{}',      -- Prime Check, Photos, Labs, Apple Health, Protocol
  stated JSONB NOT NULL DEFAULT '[]',          -- User-stated facts from chat
  inferred JSONB NOT NULL DEFAULT '[]',        -- Patterns Eden noticed
  notable_events JSONB NOT NULL DEFAULT '[]',  -- Milestones, anomalies, breakthroughs
  
  -- Baselines (captured at goal start)
  baseline_snapshot JSONB DEFAULT NULL,        -- Frozen snapshot when goal was created
  baseline_date TIMESTAMPTZ DEFAULT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Index for user lookups
CREATE INDEX idx_eden_user_memory_user_id ON eden_user_memory(user_id);

-- Enable RLS
ALTER TABLE eden_user_memory ENABLE ROW LEVEL SECURITY;

-- Users can only access their own memory
CREATE POLICY "Users can view own memory"
  ON eden_user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory"
  ON eden_user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory"
  ON eden_user_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory"
  ON eden_user_memory FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_eden_user_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER eden_user_memory_updated_at
  BEFORE UPDATE ON eden_user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_eden_user_memory_updated_at();

-- Comments for documentation
COMMENT ON TABLE eden_user_memory IS 'Structured memory for Eden coaching - prevents hallucination through sourced facts';
COMMENT ON COLUMN eden_user_memory.confirmed IS 'Ground truth from data sources: prime_check, body_photos, labs, apple_health, protocol';
COMMENT ON COLUMN eden_user_memory.stated IS 'Facts user stated in chat - trusted but not verified';
COMMENT ON COLUMN eden_user_memory.inferred IS 'Patterns Eden noticed - may be wrong, user can remove';
COMMENT ON COLUMN eden_user_memory.notable_events IS 'Evolution story: milestones, anomalies, breakthroughs';
COMMENT ON COLUMN eden_user_memory.baseline_snapshot IS 'Frozen snapshot captured when goal was created for trend calculation';

