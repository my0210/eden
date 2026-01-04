/**
 * Decision Evaluator
 * 
 * Re-evaluates past decisions at scheduled dates.
 * Records whether changes were successful.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { LLM_MODELS } from '@/lib/llm/models'
import { ProtocolDecision, DecisionOutcomeStatus } from './types'
import { getPendingReevaluations, recordDecisionOutcome } from './decisionLogging'

// Lazy initialization
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

const EVALUATION_PROMPT = `You are evaluating whether a change to a coaching protocol was successful.

Given:
1. The original decision (what was changed and why)
2. The expected outcome
3. Current adherence data since the change

Determine if the change was successful, unsuccessful, or mixed.

Respond with JSON:
{
  "outcome_status": "successful" | "unsuccessful" | "mixed",
  "outcome_notes": "Brief explanation (1-2 sentences)",
  "recommendation": "Keep change" | "Consider reverting" | "Further adaptation needed"
}

Guidelines:
- "successful": Adherence improved or user achieved what was expected
- "unsuccessful": No improvement or worse outcomes
- "mixed": Some improvement in some areas, not others`

export interface EvaluationContext {
  decision: ProtocolDecision
  adherenceSinceChange: {
    actionsCompletedRate: number // 0-100
    weeksTracked: number
  }
}

export interface EvaluationResult {
  decision_id: string
  outcome_status: DecisionOutcomeStatus
  outcome_notes: string
  recommendation: string
}

/**
 * Evaluate a single decision
 */
export async function evaluateDecision(
  context: EvaluationContext
): Promise<EvaluationResult> {
  const { decision, adherenceSinceChange } = context

  // Build evaluation prompt
  const evalContext = `
DECISION MADE:
- Trigger: ${decision.trigger_type}
- Reason: ${decision.reason}
- Expected outcome: ${decision.expected_outcome || 'Improved adherence'}

CHANGES MADE:
${decision.changes_made ? JSON.stringify(decision.changes_made, null, 2) : 'Initial protocol generation'}

ADHERENCE SINCE CHANGE:
- Action completion rate: ${adherenceSinceChange.actionsCompletedRate}%
- Weeks tracked: ${adherenceSinceChange.weeksTracked}
`.trim()

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: LLM_MODELS.REASONING,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EVALUATION_PROMPT },
        { role: 'user', content: evalContext },
      ],
      temperature: 0.3,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      return {
        decision_id: decision.id,
        outcome_status: 'mixed',
        outcome_notes: 'Unable to evaluate - no LLM response',
        recommendation: 'Manual review needed',
      }
    }

    const result = JSON.parse(responseText)

    return {
      decision_id: decision.id,
      outcome_status: result.outcome_status || 'mixed',
      outcome_notes: result.outcome_notes || 'Evaluated automatically',
      recommendation: result.recommendation || 'Continue monitoring',
    }
  } catch (error) {
    console.error('Decision evaluation failed:', error)
    return {
      decision_id: decision.id,
      outcome_status: 'mixed',
      outcome_notes: 'Evaluation error - manual review recommended',
      recommendation: 'Manual review needed',
    }
  }
}

/**
 * Process all pending reevaluations for a user
 */
export async function processPendingReevaluations(
  supabase: SupabaseClient,
  userId: string
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = []

  // Get pending decisions
  const pendingDecisions = await getPendingReevaluations(supabase, userId)

  for (const decision of pendingDecisions) {
    // Get adherence data since decision was made
    const adherence = await getAdherenceSinceDecision(supabase, decision)

    // Evaluate
    const result = await evaluateDecision({
      decision,
      adherenceSinceChange: adherence,
    })

    // Record outcome
    await recordDecisionOutcome(supabase, decision.id, {
      status: result.outcome_status,
      notes: result.outcome_notes,
    })

    results.push(result)
  }

  return results
}

/**
 * Get adherence data since a decision was made
 */
async function getAdherenceSinceDecision(
  supabase: SupabaseClient,
  decision: ProtocolDecision
): Promise<{
  actionsCompletedRate: number
  weeksTracked: number
}> {
  const decisionDate = new Date(decision.created_at)
  const now = new Date()
  const daysSince = Math.floor((now.getTime() - decisionDate.getTime()) / (24 * 60 * 60 * 1000))
  const weeksTracked = Math.max(1, Math.ceil(daysSince / 7))

  // Get actions for this protocol
  const { data: actions } = await supabase
    .from('eden_protocol_actions')
    .select('id, completed_at')
    .eq('protocol_id', decision.protocol_id)

  const actionsTotal = actions?.length || 0
  const actionsCompleted = actions?.filter(a => {
    if (!a.completed_at) return false
    return new Date(a.completed_at) >= decisionDate
  }).length || 0

  const actionsCompletedRate = actionsTotal > 0 
    ? Math.round((actionsCompleted / actionsTotal) * 100) 
    : 0

  return {
    actionsCompletedRate,
    weeksTracked,
  }
}

/**
 * Run reevaluation as a scheduled job
 */
export async function runReevaluationJob(
  supabase: SupabaseClient
): Promise<{ processed: number; results: EvaluationResult[] }> {
  // Get all users with pending reevaluations
  const today = new Date().toISOString().slice(0, 10)

  const { data: pendingDecisions } = await supabase
    .from('eden_protocol_decisions')
    .select(`
      id,
      protocol_id,
      eden_protocols!inner (
        eden_goals!inner (
          user_id
        )
      )
    `)
    .eq('outcome_status', 'pending')
    .lte('reevaluate_at', today)

  if (!pendingDecisions || pendingDecisions.length === 0) {
    return { processed: 0, results: [] }
  }

  // Group by user
  const userIds = new Set<string>()
  for (const d of pendingDecisions) {
    // Extract user_id from nested query result
    const protocols = d.eden_protocols as unknown
    if (protocols && typeof protocols === 'object') {
      const p = protocols as { eden_goals?: { user_id?: string } }
      const userId = p.eden_goals?.user_id
      if (userId) {
        userIds.add(userId)
      }
    }
  }

  // Process each user
  const allResults: EvaluationResult[] = []
  for (const userId of userIds) {
    const results = await processPendingReevaluations(supabase, userId)
    allResults.push(...results)
  }

  return {
    processed: allResults.length,
    results: allResults,
  }
}
