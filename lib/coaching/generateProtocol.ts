/**
 * Protocol Generation
 * 
 * Creates a new protocol for a goal using LLM.
 * Includes milestones, weekly actions, and daily habits.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { buildEdenContext, summarizeContextForCoach } from '@/lib/context/buildEdenContext'
import { LLM_MODELS } from '@/lib/llm/models'
import { PROTOCOL_GENERATION_PROMPT } from './prompts'
import {
  Goal,
  Protocol,
  Milestone,
  ProtocolAction,
  Habit,
  MilestoneInput,
  ActionInput,
  HabitInput,
  GeneratedProtocol,
  ProtocolDecision,
} from './types'

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

export interface ProtocolGenerationResult {
  success: boolean
  protocol?: Protocol
  milestones?: Milestone[]
  actions?: ProtocolAction[]
  habits?: Habit[]
  decision?: ProtocolDecision
  error?: string
}

/**
 * Generate a new protocol for a goal
 */
export async function generateProtocolForGoal(
  supabase: SupabaseClient,
  userId: string,
  goal: Goal
): Promise<ProtocolGenerationResult> {
  try {
    // 1) Build context
    const { edenContext } = await buildEdenContext(supabase, userId)
    const contextSummary = summarizeContextForCoach(edenContext)

    // 2) Build goal-specific context
    const goalContext = buildGoalContext(goal)

    // 3) Call LLM
    const completion = await getOpenAI().chat.completions.create({
      model: LLM_MODELS.REASONING,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROTOCOL_GENERATION_PROMPT },
        { 
          role: 'user', 
          content: `USER CONTEXT:\n${contextSummary}\n\nGOAL:\n${goalContext}\n\nGenerate a protocol for this goal.` 
        },
      ],
      temperature: 0.7,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      return { success: false, error: 'LLM did not respond' }
    }

    // 4) Parse response
    let generated: GeneratedProtocol
    try {
      generated = JSON.parse(responseText) as GeneratedProtocol
    } catch {
      console.error('Failed to parse protocol response:', responseText)
      return { success: false, error: 'Invalid LLM response format' }
    }

    // Validate response structure
    if (!generated.focus_summary || !Array.isArray(generated.milestones) || 
        !Array.isArray(generated.actions) || !Array.isArray(generated.habits)) {
      return { success: false, error: 'Missing required fields in protocol' }
    }

    // 5) Create protocol in database
    const { data: protocol, error: protocolError } = await supabase
      .from('eden_protocols')
      .insert({
        goal_id: goal.id,
        version: 1,
        parent_version_id: null,
        focus_summary: generated.focus_summary,
        total_phases: generated.milestones.length,
        current_phase: 1,
        status: 'active',
        effective_from: new Date().toISOString(),
        llm_raw: {
          model: LLM_MODELS.REASONING,
          response: generated,
          generated_at: new Date().toISOString(),
        },
        changes_from_parent: null,
      })
      .select()
      .single()

    if (protocolError || !protocol) {
      console.error('Failed to create protocol:', protocolError)
      return { success: false, error: 'Failed to save protocol' }
    }

    // 6) Create milestones
    const milestonesData = generated.milestones.map((m: MilestoneInput, i: number) => ({
      protocol_id: protocol.id,
      phase_number: m.phase_number || i + 1,
      title: m.title,
      description: m.description || null,
      success_criteria: m.success_criteria || null,
      target_date: m.target_date || calculateMilestoneDate(goal, i, generated.milestones.length),
      status: i === 0 ? 'current' : 'pending',
    }))

    const { data: milestones, error: milestonesError } = await supabase
      .from('eden_milestones')
      .insert(milestonesData)
      .select()

    if (milestonesError) {
      console.error('Failed to create milestones:', milestonesError)
    }

    // 7) Create actions
    const actionsData = generated.actions.map((a: ActionInput, i: number) => ({
      protocol_id: protocol.id,
      priority: a.priority || i + 1,
      title: a.title,
      description: a.description || null,
      metric_code: a.metric_code || null,
      target_value: a.target_value || null,
      cadence: a.cadence || null,
      week_number: a.week_number || null,
    }))

    const { data: actions, error: actionsError } = await supabase
      .from('eden_protocol_actions')
      .insert(actionsData)
      .select()

    if (actionsError) {
      console.error('Failed to create actions:', actionsError)
    }

    // 8) Create habits
    const habitsData = generated.habits.map((h: HabitInput) => ({
      protocol_id: protocol.id,
      title: h.title,
      description: h.description || null,
      frequency: h.frequency || 'daily',
      custom_frequency_json: h.custom_frequency_json || null,
      current_streak: 0,
      best_streak: 0,
      is_active: true,
    }))

    const { data: habits, error: habitsError } = await supabase
      .from('eden_habits')
      .insert(habitsData)
      .select()

    if (habitsError) {
      console.error('Failed to create habits:', habitsError)
    }

    // 9) Create decision log for initial generation
    const { data: decision, error: decisionError } = await supabase
      .from('eden_protocol_decisions')
      .insert({
        protocol_id: protocol.id,
        trigger_type: 'initial_generation',
        trigger_context: {
          goal_id: goal.id,
          goal_type: goal.goal_type,
          target_description: goal.target_description,
          duration_weeks: goal.duration_weeks,
        },
        reason: `Initial protocol created for goal: ${goal.target_description}`,
        changes_made: null,
        expected_outcome: generated.focus_summary,
        reevaluate_at: calculateFirstReevalDate(goal),
        outcome_status: 'pending',
      })
      .select()
      .single()

    if (decisionError) {
      console.error('Failed to create decision log:', decisionError)
    }

    // 10) Update goal to started
    if (!goal.started_at) {
      await supabase
        .from('eden_goals')
        .update({ 
          started_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', goal.id)
    }

    return {
      success: true,
      protocol: protocol as Protocol,
      milestones: (milestones || []) as Milestone[],
      actions: (actions || []) as ProtocolAction[],
      habits: (habits || []) as Habit[],
      decision: decision as ProtocolDecision,
    }
  } catch (error) {
    console.error('Protocol generation failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Build goal context string for LLM
 */
function buildGoalContext(goal: Goal): string {
  const parts: string[] = []
  
  parts.push(`Goal Type: ${goal.goal_type}`)
  if (goal.domain) parts.push(`Domain: ${goal.domain}`)
  parts.push(`Target: ${goal.target_description}`)
  
  if (goal.baseline_value !== null && goal.target_value !== null) {
    parts.push(`Progress: ${goal.baseline_value} → ${goal.target_value}`)
  }
  
  parts.push(`Duration: ${goal.duration_weeks} weeks`)
  
  // Constraints
  const constraints = goal.constraints_json || {}
  const constraintLines: string[] = []
  
  if (constraints.injuries?.length) {
    constraintLines.push(`INJURIES (must avoid): ${constraints.injuries.join(', ')}`)
  }
  if (constraints.time_restrictions?.length) {
    constraintLines.push(`TIME RESTRICTIONS: ${constraints.time_restrictions.join(', ')}`)
  }
  if (constraints.equipment_limitations?.length) {
    constraintLines.push(`EQUIPMENT: ${constraints.equipment_limitations.join(', ')}`)
  }
  if (constraints.red_lines?.length) {
    constraintLines.push(`WON'T DO (red lines): ${constraints.red_lines.join(', ')}`)
  }
  if (constraints.other?.length) {
    constraintLines.push(`OTHER: ${constraints.other.join(', ')}`)
  }
  
  if (constraintLines.length > 0) {
    parts.push(`\nCONSTRAINTS:\n${constraintLines.join('\n')}`)
  }
  
  return parts.join('\n')
}

/**
 * Calculate milestone target date
 */
function calculateMilestoneDate(
  goal: Goal, 
  milestoneIndex: number, 
  totalMilestones: number
): string {
  const startDate = goal.started_at ? new Date(goal.started_at) : new Date()
  const weeksPerMilestone = goal.duration_weeks / totalMilestones
  const targetDate = new Date(startDate)
  targetDate.setDate(targetDate.getDate() + Math.round((milestoneIndex + 1) * weeksPerMilestone * 7))
  return targetDate.toISOString().slice(0, 10)
}

/**
 * Calculate first re-evaluation date (typically 1 week after start)
 */
function calculateFirstReevalDate(goal: Goal): string {
  const startDate = goal.started_at ? new Date(goal.started_at) : new Date()
  const reevalDate = new Date(startDate)
  reevalDate.setDate(reevalDate.getDate() + 7)
  return reevalDate.toISOString().slice(0, 10)
}

