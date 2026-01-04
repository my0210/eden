-- Migration: Coaching System
-- Creates new goal-based coaching tables and removes legacy plan tables

-- ============================================================================
-- 1. Create eden_goals table
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Goal definition
  goal_type TEXT NOT NULL CHECK (goal_type IN ('domain', 'outcome', 'composite')),
  domain TEXT CHECK (domain IN ('heart', 'frame', 'metabolism', 'recovery', 'mind')),
  target_description TEXT NOT NULL,
  target_metric_code TEXT,
  target_value NUMERIC,
  baseline_value NUMERIC,
  duration_weeks INTEGER NOT NULL,
  
  -- Constraints captured during goal commitment
  constraints_json JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused', 'abandoned')),
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying active goals
CREATE INDEX IF NOT EXISTS idx_eden_goals_user_status ON eden_goals(user_id, status);

-- RLS
ALTER TABLE eden_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals" ON eden_goals
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Create eden_protocols table (versioned)
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES eden_goals(id) ON DELETE CASCADE,
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  parent_version_id UUID REFERENCES eden_protocols(id) ON DELETE SET NULL,
  
  -- Protocol content
  focus_summary TEXT,
  total_phases INTEGER NOT NULL DEFAULT 1,
  current_phase INTEGER NOT NULL DEFAULT 1,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
  
  -- Version lifecycle
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  
  -- LLM response storage
  llm_raw JSONB,
  changes_from_parent JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: only one active protocol version per goal
  CONSTRAINT unique_active_protocol_per_goal UNIQUE (goal_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Index for querying active protocols
CREATE INDEX IF NOT EXISTS idx_eden_protocols_goal_status ON eden_protocols(goal_id, status);
CREATE INDEX IF NOT EXISTS idx_eden_protocols_version ON eden_protocols(goal_id, version);

-- RLS (via goal ownership)
ALTER TABLE eden_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage protocols for their goals" ON eden_protocols
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM eden_goals g 
      WHERE g.id = eden_protocols.goal_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. Create eden_protocol_decisions table (accountability log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_protocol_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES eden_protocols(id) ON DELETE CASCADE,
  
  -- What triggered the decision
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'weekly_review', 'milestone_review', 'user_request', 
    'metric_change', 'coach_recommendation', 'initial_generation'
  )),
  trigger_context JSONB,
  
  -- Decision details
  reason TEXT NOT NULL,
  changes_made JSONB,
  expected_outcome TEXT,
  
  -- Re-evaluation tracking
  reevaluate_at DATE,
  outcome_notes TEXT,
  outcome_status TEXT CHECK (outcome_status IN ('pending', 'successful', 'unsuccessful', 'mixed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying decisions by protocol
CREATE INDEX IF NOT EXISTS idx_eden_protocol_decisions_protocol ON eden_protocol_decisions(protocol_id);
CREATE INDEX IF NOT EXISTS idx_eden_protocol_decisions_reevaluate ON eden_protocol_decisions(reevaluate_at) 
  WHERE outcome_status = 'pending';

-- RLS (via protocol -> goal ownership)
ALTER TABLE eden_protocol_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions for their protocols" ON eden_protocol_decisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM eden_protocols p 
      JOIN eden_goals g ON g.id = p.goal_id 
      WHERE p.id = eden_protocol_decisions.protocol_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. Create eden_milestones table
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES eden_protocols(id) ON DELETE CASCADE,
  
  -- Milestone definition
  phase_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  success_criteria TEXT,
  
  -- Timing
  target_date DATE,
  completed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed', 'skipped')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique phase per protocol
  CONSTRAINT unique_phase_per_protocol UNIQUE (protocol_id, phase_number)
);

-- Index for querying milestones
CREATE INDEX IF NOT EXISTS idx_eden_milestones_protocol ON eden_milestones(protocol_id);
CREATE INDEX IF NOT EXISTS idx_eden_milestones_status ON eden_milestones(protocol_id, status);

-- RLS (via protocol -> goal ownership)
ALTER TABLE eden_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage milestones for their protocols" ON eden_milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM eden_protocols p 
      JOIN eden_goals g ON g.id = p.goal_id 
      WHERE p.id = eden_milestones.protocol_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Create eden_protocol_actions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_protocol_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES eden_protocols(id) ON DELETE CASCADE,
  
  -- Action definition
  priority INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Targeting
  metric_code TEXT,
  target_value TEXT,
  cadence TEXT, -- 'daily', '3x/week', 'once', etc.
  
  -- Week assignment (which week of the protocol)
  week_number INTEGER,
  
  -- Completion tracking
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying actions
CREATE INDEX IF NOT EXISTS idx_eden_protocol_actions_protocol ON eden_protocol_actions(protocol_id);
CREATE INDEX IF NOT EXISTS idx_eden_protocol_actions_week ON eden_protocol_actions(protocol_id, week_number);

-- RLS (via protocol -> goal ownership)
ALTER TABLE eden_protocol_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage actions for their protocols" ON eden_protocol_actions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM eden_protocols p 
      JOIN eden_goals g ON g.id = p.goal_id 
      WHERE p.id = eden_protocol_actions.protocol_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. Create eden_habits table
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES eden_protocols(id) ON DELETE CASCADE,
  
  -- Habit definition
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', '3x_week', '5x_week', 'custom')),
  custom_frequency_json JSONB, -- for custom schedules
  
  -- Streak tracking
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_logged_at DATE,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying habits
CREATE INDEX IF NOT EXISTS idx_eden_habits_protocol ON eden_habits(protocol_id);
CREATE INDEX IF NOT EXISTS idx_eden_habits_active ON eden_habits(protocol_id, is_active);

-- RLS (via protocol -> goal ownership)
ALTER TABLE eden_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage habits for their protocols" ON eden_habits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM eden_protocols p 
      JOIN eden_goals g ON g.id = p.goal_id 
      WHERE p.id = eden_habits.protocol_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. Create eden_habit_logs table
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES eden_habits(id) ON DELETE CASCADE,
  
  -- Log entry
  logged_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One log per habit per day
  CONSTRAINT unique_habit_log_per_day UNIQUE (habit_id, logged_date)
);

-- Index for querying habit logs
CREATE INDEX IF NOT EXISTS idx_eden_habit_logs_habit ON eden_habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_eden_habit_logs_date ON eden_habit_logs(habit_id, logged_date);

-- RLS (via habit -> protocol -> goal ownership)
ALTER TABLE eden_habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage logs for their habits" ON eden_habit_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM eden_habits h
      JOIN eden_protocols p ON p.id = h.protocol_id
      JOIN eden_goals g ON g.id = p.goal_id 
      WHERE h.id = eden_habit_logs.habit_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. Create eden_checkins table
-- ============================================================================
CREATE TABLE IF NOT EXISTS eden_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES eden_protocols(id) ON DELETE CASCADE,
  
  -- Check-in type
  checkin_type TEXT NOT NULL CHECK (checkin_type IN (
    'daily_nudge', 'weekly_review', 'milestone_review', 'ad_hoc'
  )),
  
  -- Check-in content
  week_number INTEGER,
  milestone_id UUID REFERENCES eden_milestones(id) ON DELETE SET NULL,
  
  -- Summary data at check-in time
  summary_json JSONB, -- actions completed, habits logged, etc.
  
  -- User response (if any)
  user_response TEXT,
  
  -- Coach follow-up
  coach_response TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying check-ins
CREATE INDEX IF NOT EXISTS idx_eden_checkins_protocol ON eden_checkins(protocol_id);
CREATE INDEX IF NOT EXISTS idx_eden_checkins_type ON eden_checkins(protocol_id, checkin_type);

-- RLS (via protocol -> goal ownership)
ALTER TABLE eden_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage check-ins for their protocols" ON eden_checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM eden_protocols p 
      JOIN eden_goals g ON g.id = p.goal_id 
      WHERE p.id = eden_checkins.protocol_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. Drop legacy plan tables
-- ============================================================================
-- Drop actions first (FK constraint)
DROP TABLE IF EXISTS eden_plan_actions;
-- Then drop plans
DROP TABLE IF EXISTS eden_plans;

-- ============================================================================
-- 10. Update triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to eden_goals
DROP TRIGGER IF EXISTS update_eden_goals_updated_at ON eden_goals;
CREATE TRIGGER update_eden_goals_updated_at
  BEFORE UPDATE ON eden_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

