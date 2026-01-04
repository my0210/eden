/**
 * Coaching System Types
 * 
 * Types for goals, protocols, milestones, actions, and decisions.
 */

import { PrimeDomain } from '@/lib/prime-scorecard/types'

// ============================================================================
// Goal Types
// ============================================================================

export type GoalType = 'domain' | 'outcome' | 'composite'

export type GoalStatus = 'draft' | 'active' | 'completed' | 'paused' | 'abandoned'

export interface GoalConstraints {
  injuries?: string[]
  time_restrictions?: string[]
  equipment_limitations?: string[]
  red_lines?: string[]
  other?: string[]
}

export interface Goal {
  id: string
  user_id: string
  goal_type: GoalType
  domain: PrimeDomain | null
  target_description: string
  target_metric_code: string | null
  target_value: number | null
  baseline_value: number | null
  duration_weeks: number
  constraints_json: GoalConstraints
  status: GoalStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface GoalInput {
  goal_type: GoalType
  domain?: PrimeDomain
  target_description: string
  target_metric_code?: string
  target_value?: number
  baseline_value?: number
  duration_weeks: number
  constraints?: GoalConstraints
}

// ============================================================================
// Protocol Types
// ============================================================================

export type ProtocolStatus = 'active' | 'superseded' | 'archived'

export interface Protocol {
  id: string
  goal_id: string
  version: number
  parent_version_id: string | null
  focus_summary: string | null
  total_phases: number
  current_phase: number
  status: ProtocolStatus
  effective_from: string
  effective_until: string | null
  llm_raw: Record<string, unknown> | null
  changes_from_parent: ProtocolChanges | null
  created_at: string
}

export interface ProtocolChanges {
  actions?: {
    added?: string[]
    removed?: string[]
    modified?: string[]
  }
  milestones?: {
    added?: string[]
    removed?: string[]
    modified?: string[]
  }
  summary?: string
}

// ============================================================================
// Protocol Decision Types
// ============================================================================

export type DecisionTriggerType = 
  | 'weekly_review' 
  | 'milestone_review' 
  | 'user_request' 
  | 'metric_change' 
  | 'coach_recommendation'
  | 'initial_generation'

export type DecisionOutcomeStatus = 'pending' | 'successful' | 'unsuccessful' | 'mixed'

export interface ProtocolDecision {
  id: string
  protocol_id: string
  trigger_type: DecisionTriggerType
  trigger_context: Record<string, unknown> | null
  reason: string
  changes_made: ProtocolChanges | null
  expected_outcome: string | null
  reevaluate_at: string | null
  outcome_notes: string | null
  outcome_status: DecisionOutcomeStatus | null
  created_at: string
}

// ============================================================================
// Milestone Types
// ============================================================================

export type MilestoneStatus = 'pending' | 'current' | 'completed' | 'skipped'

export interface Milestone {
  id: string
  protocol_id: string
  phase_number: number
  title: string
  description: string | null
  success_criteria: string | null
  target_date: string | null
  completed_at: string | null
  status: MilestoneStatus
  created_at: string
}

export interface MilestoneInput {
  phase_number: number
  title: string
  description?: string
  success_criteria?: string
  target_date?: string
}

// ============================================================================
// Action Types
// ============================================================================

export interface ProtocolAction {
  id: string
  protocol_id: string
  priority: number
  title: string
  description: string | null
  metric_code: string | null
  target_value: string | null
  cadence: string | null
  week_number: number | null
  completed_at: string | null
  created_at: string
}

export interface ActionInput {
  priority: number
  title: string
  description?: string
  metric_code?: string
  target_value?: string
  cadence?: string
  week_number?: number
}

// ============================================================================
// Check-in Types
// ============================================================================

export type CheckinType = 'daily_nudge' | 'weekly_review' | 'milestone_review' | 'ad_hoc'

export interface Checkin {
  id: string
  protocol_id: string
  checkin_type: CheckinType
  week_number: number | null
  milestone_id: string | null
  summary_json: CheckinSummary | null
  user_response: string | null
  coach_response: string | null
  created_at: string
}

export interface CheckinSummary {
  actions_completed: number
  actions_total: number
  notes?: string
}

// ============================================================================
// Context Types (for coach)
// ============================================================================

export interface GoalContext {
  id: string
  goal_type: GoalType
  target_description: string
  domain: PrimeDomain | null
  baseline_value: number | null
  target_value: number | null
  duration_weeks: number
  started_at: string | null
  constraints: GoalConstraints
}

export interface ProtocolContext {
  id: string
  version: number
  focus_summary: string | null
  current_phase: number
  total_phases: number
  current_milestone: {
    title: string
    target_date: string | null
    success_criteria: string | null
  } | null
  weekly_adherence: {
    actions_completed: number
    actions_total: number
  }
}

// ============================================================================
// LLM Response Types
// ============================================================================

export interface ExtractedGoal {
  goal_type: GoalType
  domain?: PrimeDomain
  target_description: string
  target_metric_code?: string
  target_value?: number
  duration_weeks: number
  constraints?: GoalConstraints
  confidence: number // 0-1 how confident the extraction is
}

export interface GeneratedProtocol {
  focus_summary: string
  milestones: MilestoneInput[]
  actions: ActionInput[]
}
