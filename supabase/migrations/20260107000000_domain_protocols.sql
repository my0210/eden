-- Migration: Domain-Centered Coaching
-- Extends existing tables and adds week instance tables for domain protocols

-- ============================================================================
-- 1. Extend eden_goals with domain protocol fields
-- ============================================================================

-- goal_type distinguishes domain protocols from user-defined outcome goals
ALTER TABLE eden_goals ADD COLUMN IF NOT EXISTS
  goal_type TEXT DEFAULT 'outcome' CHECK (goal_type IN ('domain', 'outcome'));

-- priority for ordering domain protocols (1 = primary, 2 = secondary, 3 = tertiary)
ALTER TABLE eden_goals ADD COLUMN IF NOT EXISTS
  priority INTEGER;

-- ============================================================================
-- 2. Extend eden_protocols with template tracking
-- ============================================================================

-- template_id identifies which domain template was used
ALTER TABLE eden_protocols ADD COLUMN IF NOT EXISTS
  template_id TEXT;

-- template_version tracks which version of the template
ALTER TABLE eden_protocols ADD COLUMN IF NOT EXISTS
  template_version INTEGER;

-- personalization_json stores AI customizations on top of the template
ALTER TABLE eden_protocols ADD COLUMN IF NOT EXISTS
  personalization_json JSONB;

-- ============================================================================
-- 3. Create eden_protocol_weeks table (week instances)
-- ============================================================================

CREATE TABLE IF NOT EXISTS eden_protocol_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol_id UUID NOT NULL REFERENCES eden_protocols(id) ON DELETE CASCADE,
  protocol_version INTEGER NOT NULL,
  week_start DATE NOT NULL,
  scorecard_snapshot_json JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (protocol_id, week_start)
);

-- RLS for eden_protocol_weeks
ALTER TABLE eden_protocol_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their protocol weeks" ON eden_protocol_weeks
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for eden_protocol_weeks
CREATE INDEX IF NOT EXISTS idx_protocol_weeks_user ON eden_protocol_weeks(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_protocol_weeks_protocol ON eden_protocol_weeks(protocol_id, week_start);

-- ============================================================================
-- 4. Create eden_week_items table (resolved action instances)
-- ============================================================================

CREATE TABLE IF NOT EXISTS eden_week_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES eden_protocol_weeks(id) ON DELETE CASCADE,
  source_action_id UUID,
  item_type TEXT DEFAULT 'action' CHECK (item_type IN ('action', 'habit')),
  title TEXT NOT NULL,
  description TEXT,
  target_value TEXT,
  success_criteria TEXT,
  fallback TEXT,
  
  -- Completion tracking (quota model)
  target_count INTEGER DEFAULT 1,
  completed_count INTEGER DEFAULT 0,
  completion_events JSONB DEFAULT '[]'::jsonb,
  
  -- Skip tracking
  skipped_at TIMESTAMPTZ,
  skip_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for eden_week_items
ALTER TABLE eden_week_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their week items" ON eden_week_items
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for eden_week_items
CREATE INDEX IF NOT EXISTS idx_week_items_user_week ON eden_week_items(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_week_items_week ON eden_week_items(week_id);

-- ============================================================================
-- 5. Helper function to get week end date
-- ============================================================================

CREATE OR REPLACE FUNCTION get_week_end(week_start DATE)
RETURNS DATE AS $$
BEGIN
  RETURN week_start + INTERVAL '6 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON TABLE eden_protocol_weeks IS 'Frozen weekly snapshots derived from protocol versions. Once created, immutable.';
COMMENT ON TABLE eden_week_items IS 'Resolved action instances for a specific week. Tracks completion with quota model.';
COMMENT ON COLUMN eden_goals.goal_type IS 'domain = domain-centered protocol, outcome = user-defined goal';
COMMENT ON COLUMN eden_goals.priority IS '1 = primary focus, 2 = secondary, 3 = tertiary (optional)';
COMMENT ON COLUMN eden_protocols.template_id IS 'Domain template identifier: heart, frame, metabolism, recovery, mind';
COMMENT ON COLUMN eden_protocols.template_version IS 'Version of the template used to generate this protocol';
COMMENT ON COLUMN eden_week_items.target_count IS 'How many times this item should be completed this week (7 for daily, 3 for 3x/week, 1 for once)';
COMMENT ON COLUMN eden_week_items.completion_events IS 'Array of completion events: [{at: timestamp, notes: string}]';

