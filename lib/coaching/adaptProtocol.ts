/**
 * Protocol Adaptation
 * 
 * Adapts existing protocols based on user progress.
 * Creates new versions with full decision logging.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PROTOCOL_ADAPTATION_PROMPT } from './prompts'
import {
  Protocol,
  ProtocolAction,
  Habit,
  DecisionTriggerType,
  ActionInput,
  HabitInput,
  ProtocolChanges,
} from './types'
import { createNewVersion, calculateChanges, getProtocolWithDetails } from './protocolVersioning'
import { createDecision, buildWeeklyReviewContext, buildMilestoneReviewContext } from './decisionLogging'

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

export interface AdaptationContext {
  triggerType: DecisionTriggerType
  weekNumber?: number
  actionsCompleted: number
  actionsTotal: number
  habits: Record<string, { completed: number; target: number }>
  milestoneId?: string
  milestoneTitle?: string
  newConstraints?: string[]
  userFeedback?: string
}

export interface AdaptationResult {
  success: boolean
  newProtocol?: Protocol
  changes?: ProtocolChanges
  reason?: string
  error?: string
}

/**
 * Adapt a protocol based on user progress
 */
export async function adaptProtocol(
  supabase: SupabaseClient,
  protocolId: string,
  context: AdaptationContext
): Promise<AdaptationResult> {
  try {
    // 1) Get current protocol with details
    const { protocol, actions, habits, milestones } = await getProtocolWithDetails(supabase, protocolId)

    if (!protocol) {
      return { success: false, error: 'Protocol not found' }
    }

    // 2) Build adaptation context for LLM
    const adaptationPrompt = buildAdaptationPrompt(protocol, actions, habits, context)

    // 3) Call LLM for adaptation suggestions
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROTOCOL_ADAPTATION_PROMPT },
        { role: 'user', content: adaptationPrompt },
      ],
      temperature: 0.6,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      return { success: false, error: 'LLM did not respond' }
    }

    // 4) Parse response
    let adaptation
    try {
      adaptation = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse adaptation response:', responseText)
      return { success: false, error: 'Invalid LLM response' }
    }

    // Check if any changes are suggested
    const noChanges = !adaptation.changes || 
      (Object.keys(adaptation.changes.actions || {}).every(k => 
        !adaptation.changes.actions[k]?.length) &&
       Object.keys(adaptation.changes.habits || {}).every(k => 
        !adaptation.changes.habits[k]?.length))

    if (noChanges) {
      return { 
        success: true, 
        reason: adaptation.analysis?.key_insight || 'No changes needed',
      }
    }

    // 5) Build new actions and habits lists
    const newActions = buildNewActionsList(actions, adaptation.changes.actions)
    const newHabits = buildNewHabitsList(habits, adaptation.changes.habits)

    // 6) Calculate changes for logging
    const changes = calculateChanges(actions, newActions, habits, newHabits)

    // 7) Create new protocol version
    const versionResult = await createNewVersion(
      supabase,
      protocol,
      {
        focus_summary: protocol.focus_summary || undefined,
        actions: newActions,
        habits: newHabits,
        milestones: adaptation.changes.milestones?.adjust_dates,
      },
      changes,
      {
        model: 'gpt-5',
        adaptation,
        generated_at: new Date().toISOString(),
      }
    )

    if (!versionResult.success || !versionResult.newProtocol) {
      return { success: false, error: versionResult.error }
    }

    // 8) Create decision log
    const triggerContext = context.triggerType === 'weekly_review'
      ? buildWeeklyReviewContext({
          week_number: context.weekNumber || 1,
          actions_completed: context.actionsCompleted,
          actions_total: context.actionsTotal,
          habits: context.habits,
        })
      : context.triggerType === 'milestone_review'
        ? buildMilestoneReviewContext({
            milestone_id: context.milestoneId || '',
            milestone_title: context.milestoneTitle || '',
            phase_number: protocol.current_phase,
            days_taken: 0, // Would calculate from actual dates
            expected_days: 14,
            success_criteria_met: true,
          })
        : { trigger: context.triggerType, context }

    const reevaluateDate = new Date()
    reevaluateDate.setDate(reevaluateDate.getDate() + (adaptation.reevaluate_in_days || 7))

    await createDecision(supabase, {
      protocol_id: versionResult.newProtocol.id,
      trigger_type: context.triggerType,
      trigger_context: triggerContext,
      reason: adaptation.reason || 'Protocol adapted based on progress',
      changes_made: changes,
      expected_outcome: adaptation.expected_outcome || 'Improved adherence',
      reevaluate_at: reevaluateDate.toISOString().slice(0, 10),
    })

    return {
      success: true,
      newProtocol: versionResult.newProtocol,
      changes,
      reason: adaptation.reason,
    }
  } catch (error) {
    console.error('Protocol adaptation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Build the prompt for adaptation LLM call
 */
function buildAdaptationPrompt(
  protocol: Protocol,
  actions: ProtocolAction[],
  habits: Habit[],
  context: AdaptationContext
): string {
  const parts: string[] = []

  // Protocol info
  parts.push(`CURRENT PROTOCOL (v${protocol.version}):`)
  parts.push(`Focus: ${protocol.focus_summary}`)
  parts.push(`Phase: ${protocol.current_phase}/${protocol.total_phases}`)

  // Actions
  parts.push('\nACTIONS:')
  actions.forEach((a, i) => {
    parts.push(`${i + 1}. ${a.title} (${a.cadence || 'ongoing'})${a.completed_at ? ' ✓' : ''}`)
  })

  // Habits
  parts.push('\nHABITS:')
  habits.forEach((h, i) => {
    parts.push(`${i + 1}. ${h.title} (${h.frequency}) - streak: ${h.current_streak}`)
  })

  // Adherence data
  parts.push('\nADHERENCE THIS WEEK:')
  parts.push(`Actions: ${context.actionsCompleted}/${context.actionsTotal}`)
  
  if (Object.keys(context.habits).length > 0) {
    parts.push('Habits:')
    Object.entries(context.habits).forEach(([name, data]) => {
      parts.push(`  - ${name}: ${data.completed}/${data.target}`)
    })
  }

  // Trigger info
  parts.push(`\nTRIGGER: ${context.triggerType}`)
  if (context.weekNumber) {
    parts.push(`Week: ${context.weekNumber}`)
  }

  // Any user feedback
  if (context.userFeedback) {
    parts.push(`\nUSER FEEDBACK: "${context.userFeedback}"`)
  }

  // Any new constraints
  if (context.newConstraints?.length) {
    parts.push(`\nNEW CONSTRAINTS MENTIONED:`)
    context.newConstraints.forEach(c => parts.push(`- ${c}`))
  }

  return parts.join('\n')
}

/**
 * Build new actions list from adaptation changes
 */
function buildNewActionsList(
  currentActions: ProtocolAction[],
  changes: {
    add?: Array<{ title: string; description?: string; cadence?: string }>
    remove?: string[]
    modify?: Array<{ title: string; new_cadence?: string; new_description?: string }>
  } | undefined
): ActionInput[] {
  if (!changes) {
    return currentActions.map((a, i) => ({
      priority: i + 1,
      title: a.title,
      description: a.description || undefined,
      cadence: a.cadence || undefined,
      metric_code: a.metric_code || undefined,
      target_value: a.target_value || undefined,
      week_number: a.week_number || undefined,
    }))
  }

  const removeSet = new Set((changes.remove || []).map(t => t.toLowerCase()))
  const modifyMap = new Map(
    (changes.modify || []).map(m => [m.title.toLowerCase(), m])
  )

  // Filter out removed, apply modifications
  const keptActions = currentActions
    .filter(a => !removeSet.has(a.title.toLowerCase()))
    .map((a, i) => {
      const mod = modifyMap.get(a.title.toLowerCase())
      return {
        priority: i + 1,
        title: a.title,
        description: mod?.new_description || a.description || undefined,
        cadence: mod?.new_cadence || a.cadence || undefined,
        metric_code: a.metric_code || undefined,
        target_value: a.target_value || undefined,
        week_number: a.week_number || undefined,
      }
    })

  // Add new actions
  const addedActions = (changes.add || []).map((a, i) => ({
    priority: keptActions.length + i + 1,
    title: a.title,
    description: a.description,
    cadence: a.cadence,
  }))

  return [...keptActions, ...addedActions]
}

/**
 * Build new habits list from adaptation changes
 */
function buildNewHabitsList(
  currentHabits: Habit[],
  changes: {
    add?: Array<{ title: string; description?: string; frequency?: string }>
    remove?: string[]
    modify?: Array<{ title: string; new_frequency?: string }>
  } | undefined
): HabitInput[] {
  if (!changes) {
    return currentHabits.map(h => ({
      title: h.title,
      description: h.description || undefined,
      frequency: h.frequency as HabitInput['frequency'],
    }))
  }

  const removeSet = new Set((changes.remove || []).map(t => t.toLowerCase()))
  const modifyMap = new Map(
    (changes.modify || []).map(m => [m.title.toLowerCase(), m])
  )

  // Filter out removed, apply modifications
  const keptHabits = currentHabits
    .filter(h => !removeSet.has(h.title.toLowerCase()))
    .map(h => {
      const mod = modifyMap.get(h.title.toLowerCase())
      return {
        title: h.title,
        description: h.description || undefined,
        frequency: (mod?.new_frequency || h.frequency) as HabitInput['frequency'],
      }
    })

  // Add new habits
  const addedHabits = (changes.add || []).map(h => ({
    title: h.title,
    description: h.description,
    frequency: (h.frequency || 'daily') as HabitInput['frequency'],
  }))

  return [...keptHabits, ...addedHabits]
}

