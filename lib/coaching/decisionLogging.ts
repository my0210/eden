/**
 * Decision Logging
 * 
 * Records protocol decisions with full accountability:
 * - What triggered the change
 * - Why the change was made
 * - What changed
 * - Expected outcome
 * - Re-evaluation date
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  ProtocolDecision,
  DecisionTriggerType,
  DecisionOutcomeStatus,
  ProtocolChanges,
} from './types'

export interface DecisionInput {
  protocol_id: string
  trigger_type: DecisionTriggerType
  trigger_context: Record<string, unknown>
  reason: string
  changes_made: ProtocolChanges | null
  expected_outcome: string
  reevaluate_at: string // YYYY-MM-DD
}

/**
 * Create a new decision log entry
 */
export async function createDecision(
  supabase: SupabaseClient,
  input: DecisionInput
): Promise<{ success: boolean; decision?: ProtocolDecision; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('eden_protocol_decisions')
      .insert({
        protocol_id: input.protocol_id,
        trigger_type: input.trigger_type,
        trigger_context: input.trigger_context,
        reason: input.reason,
        changes_made: input.changes_made,
        expected_outcome: input.expected_outcome,
        reevaluate_at: input.reevaluate_at,
        outcome_status: 'pending',
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, decision: data as ProtocolDecision }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all decisions for a protocol
 */
export async function getDecisionsForProtocol(
  supabase: SupabaseClient,
  protocolId: string
): Promise<ProtocolDecision[]> {
  const { data, error } = await supabase
    .from('eden_protocol_decisions')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to get decisions:', error)
    return []
  }

  return (data || []) as ProtocolDecision[]
}

/**
 * Get all decisions for a goal (across all protocol versions)
 */
export async function getDecisionsForGoal(
  supabase: SupabaseClient,
  goalId: string
): Promise<ProtocolDecision[]> {
  // First get all protocol IDs for this goal
  const { data: protocols } = await supabase
    .from('eden_protocols')
    .select('id')
    .eq('goal_id', goalId)

  if (!protocols || protocols.length === 0) {
    return []
  }

  const protocolIds = protocols.map(p => p.id)

  const { data, error } = await supabase
    .from('eden_protocol_decisions')
    .select('*')
    .in('protocol_id', protocolIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to get decisions for goal:', error)
    return []
  }

  return (data || []) as ProtocolDecision[]
}

/**
 * Get decisions pending re-evaluation
 */
export async function getPendingReevaluations(
  supabase: SupabaseClient,
  userId: string
): Promise<ProtocolDecision[]> {
  const today = new Date().toISOString().slice(0, 10)

  // Get decisions where reevaluate_at is today or past and outcome_status is pending
  const { data, error } = await supabase
    .from('eden_protocol_decisions')
    .select(`
      *,
      eden_protocols!inner (
        goal_id,
        eden_goals!inner (
          user_id
        )
      )
    `)
    .eq('outcome_status', 'pending')
    .lte('reevaluate_at', today)
    .eq('eden_protocols.eden_goals.user_id', userId)
    .order('reevaluate_at', { ascending: true })

  if (error) {
    console.error('Failed to get pending reevaluations:', error)
    return []
  }

  return (data || []) as ProtocolDecision[]
}

/**
 * Update decision with outcome
 */
export async function recordDecisionOutcome(
  supabase: SupabaseClient,
  decisionId: string,
  outcome: {
    status: DecisionOutcomeStatus
    notes: string
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('eden_protocol_decisions')
    .update({
      outcome_status: outcome.status,
      outcome_notes: outcome.notes,
    })
    .eq('id', decisionId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Format a decision for display
 */
export function formatDecisionForDisplay(decision: ProtocolDecision): {
  trigger: string
  reason: string
  changes: string[]
  expected: string
  reevaluate: string
  outcome: string | null
} {
  // Format trigger
  const triggerLabels: Record<DecisionTriggerType, string> = {
    weekly_review: 'Weekly Review',
    milestone_review: 'Milestone Review',
    user_request: 'Your Request',
    metric_change: 'Scorecard Update',
    coach_recommendation: 'Coach Recommendation',
    initial_generation: 'Initial Plan',
  }
  const trigger = triggerLabels[decision.trigger_type] || decision.trigger_type

  // Format changes
  const changes: string[] = []
  if (decision.changes_made) {
    const c = decision.changes_made
    if (c.actions?.added?.length) {
      changes.push(`Added actions: ${c.actions.added.join(', ')}`)
    }
    if (c.actions?.removed?.length) {
      changes.push(`Removed actions: ${c.actions.removed.join(', ')}`)
    }
    if (c.habits?.added?.length) {
      changes.push(`Added habits: ${c.habits.added.join(', ')}`)
    }
    if (c.habits?.removed?.length) {
      changes.push(`Removed habits: ${c.habits.removed.join(', ')}`)
    }
    if (c.summary && changes.length === 0) {
      changes.push(c.summary)
    }
  }

  // Format outcome
  let outcome: string | null = null
  if (decision.outcome_status && decision.outcome_status !== 'pending') {
    const outcomeLabels: Record<DecisionOutcomeStatus, string> = {
      pending: 'Pending',
      successful: 'Worked well',
      unsuccessful: 'Didn\'t help',
      mixed: 'Mixed results',
    }
    outcome = `${outcomeLabels[decision.outcome_status]}${decision.outcome_notes ? `: ${decision.outcome_notes}` : ''}`
  }

  return {
    trigger,
    reason: decision.reason,
    changes,
    expected: decision.expected_outcome || '',
    reevaluate: decision.reevaluate_at || '',
    outcome,
  }
}

/**
 * Build trigger context for weekly review
 */
export function buildWeeklyReviewContext(data: {
  week_number: number
  actions_completed: number
  actions_total: number
  habits: Record<string, { completed: number; target: number }>
}): Record<string, unknown> {
  return {
    trigger: 'weekly_review',
    week: data.week_number,
    actions_completed: data.actions_completed,
    actions_total: data.actions_total,
    action_rate: data.actions_total > 0 
      ? Math.round((data.actions_completed / data.actions_total) * 100) 
      : 0,
    habits: data.habits,
  }
}

/**
 * Build trigger context for milestone review
 */
export function buildMilestoneReviewContext(data: {
  milestone_id: string
  milestone_title: string
  phase_number: number
  days_taken: number
  expected_days: number
  success_criteria_met: boolean
}): Record<string, unknown> {
  return {
    trigger: 'milestone_review',
    milestone_id: data.milestone_id,
    milestone_title: data.milestone_title,
    phase_number: data.phase_number,
    days_taken: data.days_taken,
    expected_days: data.expected_days,
    ahead_of_schedule: data.days_taken < data.expected_days,
    success_criteria_met: data.success_criteria_met,
  }
}

