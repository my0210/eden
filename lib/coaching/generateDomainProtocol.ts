/**
 * Domain Protocol Generation
 * 
 * Generates personalized protocols by combining:
 * 1. Domain template (evidence-based structure)
 * 2. User's setup answers
 * 3. AI personalization for specifics
 */

import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PrimeDomain } from '@/lib/prime-scorecard/types'
import { LLM_MODELS } from '@/lib/llm/models'
import { getTemplate, getTemplateVersion, getActionTemplatesForPhase } from './domain-protocols'
import {
  DomainTemplate,
  PersonalizationContext,
  PersonalizedProtocol,
  PersonalizedPhase,
  PersonalizedAction,
  ActionTemplate,
} from './domain-protocols/types'
import { Protocol, Milestone, ProtocolAction } from './types'

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

// ============================================================================
// Types
// ============================================================================

export interface GenerateDomainProtocolInput {
  userId: string
  domain: PrimeDomain
  priority: number // 1, 2, or 3
  setupAnswers: Record<string, unknown>
  constraints: string[]
  timeBudgetHours: number
  currentScore: number | null
}

export interface GenerateDomainProtocolResult {
  success: boolean
  goalId?: string
  protocolId?: string
  protocol?: PersonalizedProtocol
  error?: string
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate a personalized domain protocol
 * 
 * Flow:
 * 1. Load domain template
 * 2. Build personalization context
 * 3. Call AI to personalize actions
 * 4. Create goal and protocol in database
 */
export async function generateDomainProtocol(
  supabase: SupabaseClient,
  input: GenerateDomainProtocolInput
): Promise<GenerateDomainProtocolResult> {
  const { userId, domain, priority, setupAnswers, constraints, timeBudgetHours, currentScore } = input

  try {
    // 1. Load template
    const template = getTemplate(domain)
    const templateVersion = getTemplateVersion(domain)

    // 2. Determine experience level from answers
    const experienceLevel = determineExperienceLevel(domain, setupAnswers)

    // 3. Build personalization context
    const personalization: PersonalizationContext = {
      setupAnswers,
      currentScore,
      timeBudgetHours,
      experienceLevel,
      equipment: extractEquipment(setupAnswers),
      constraints,
      preferences: extractPreferences(setupAnswers),
    }

    // 4. Generate personalized protocol using AI
    const personalizedProtocol = await personalizeProtocol(template, personalization)

    // 5. Create goal in database
    const { data: goal, error: goalError } = await supabase
      .from('eden_goals')
      .insert({
        user_id: userId,
        goal_type: 'domain',
        domain,
        target_description: `Improve ${capitalize(domain)} domain`,
        duration_weeks: personalizedProtocol.phases.reduce((sum, p) => sum + p.durationWeeks, 0),
        priority,
        status: 'active',
        started_at: new Date().toISOString(),
        constraints_json: { constraints, setup_answers: setupAnswers },
      })
      .select()
      .single()

    if (goalError || !goal) {
      console.error('Failed to create goal:', goalError)
      return { success: false, error: 'Failed to create goal' }
    }

    // 6. Create protocol in database
    const { data: protocol, error: protocolError } = await supabase
      .from('eden_protocols')
      .insert({
        goal_id: goal.id,
        version: 1,
        template_id: domain,
        template_version: templateVersion,
        focus_summary: personalizedProtocol.focusSummary,
        total_phases: personalizedProtocol.phases.length,
        current_phase: 1,
        status: 'active',
        effective_from: new Date().toISOString(),
        personalization_json: personalization,
        llm_raw: {
          model: LLM_MODELS.STANDARD,
          generated_at: new Date().toISOString(),
          protocol: personalizedProtocol,
        },
      })
      .select()
      .single()

    if (protocolError || !protocol) {
      console.error('Failed to create protocol:', protocolError)
      return { success: false, error: 'Failed to create protocol' }
    }

    // 7. Create milestones
    const milestonesData = personalizedProtocol.phases.map((phase, i) => ({
      protocol_id: protocol.id,
      phase_number: phase.number,
      title: phase.name,
      description: phase.focus,
      success_criteria: phase.successCriteria,
      target_date: phase.targetDate || calculatePhaseEndDate(i, personalizedProtocol.phases),
      status: i === 0 ? 'current' : 'pending',
    }))

    const { error: milestonesError } = await supabase
      .from('eden_milestones')
      .insert(milestonesData)

    if (milestonesError) {
      console.error('Failed to create milestones:', milestonesError)
    }

    // 8. Create protocol actions (templates for week generation)
    const actionsData = personalizedProtocol.actions.map((action, i) => ({
      protocol_id: protocol.id,
      priority: i + 1,
      title: action.title,
      description: action.description,
      metric_code: template.actionTemplates.find(t => t.id === action.templateId)?.targetMetric || null,
      target_value: action.targetValue || null,
      cadence: getScheduleString(action.targetCount),
      week_number: null, // Protocol actions are templates, not week-specific
    }))

    const { error: actionsError } = await supabase
      .from('eden_protocol_actions')
      .insert(actionsData)

    if (actionsError) {
      console.error('Failed to create actions:', actionsError)
    }

    return {
      success: true,
      goalId: goal.id,
      protocolId: protocol.id,
      protocol: personalizedProtocol,
    }

  } catch (error) {
    console.error('Protocol generation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// AI Personalization
// ============================================================================

/**
 * Use AI to personalize the protocol based on template and user context
 */
async function personalizeProtocol(
  template: DomainTemplate,
  context: PersonalizationContext
): Promise<PersonalizedProtocol> {
  const prompt = buildPersonalizationPrompt(template, context)

  const response = await getOpenAI().chat.completions.create({
    model: LLM_MODELS.STANDARD,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    // Fallback to default personalization
    return buildDefaultProtocol(template, context)
  }

  try {
    const parsed = JSON.parse(content)
    return validateAndBuildProtocol(parsed, template, context)
  } catch {
    return buildDefaultProtocol(template, context)
  }
}

/**
 * Build the prompt for AI personalization
 */
function buildPersonalizationPrompt(template: DomainTemplate, context: PersonalizationContext): string {
  const phaseActions = getActionTemplatesForPhase(template.id, 1)

  return `You are personalizing a ${template.name} health protocol for a user.

TEMPLATE INFO:
- Domain: ${template.name}
- Focus areas: ${template.focusAreas.join(', ')}
- Phases: ${template.phases.map(p => `${p.name} (${p.durationWeeks} weeks)`).join(' → ')}

USER CONTEXT:
- Experience level: ${context.experienceLevel}
- Time budget: ${context.timeBudgetHours} hours/week
- Current score: ${context.currentScore ?? 'Unknown'}
- Equipment: ${context.equipment.length > 0 ? context.equipment.join(', ') : 'None specified'}
- Constraints: ${context.constraints.length > 0 ? context.constraints.join(', ') : 'None'}
- Preferences: ${context.preferences.length > 0 ? context.preferences.join(', ') : 'None specified'}

SETUP ANSWERS:
${JSON.stringify(context.setupAnswers, null, 2)}

AVAILABLE ACTION TEMPLATES (Phase 1):
${phaseActions.map(a => `- ${a.id}: ${a.title} (${a.defaultSchedule.frequency})`).join('\n')}

Generate a personalized protocol as JSON:
{
  "focus_summary": "1-2 sentence personalized focus for this user",
  "actions": [
    {
      "template_id": "action_template_id",
      "title": "Personalized title",
      "description": "Personalized description with specific targets",
      "target_count": 3,
      "target_value": "30 min Zone 2" or null,
      "success_criteria": "How to know it's done",
      "fallback": "What to do if can't complete"
    }
  ]
}

RULES:
1. Only include actions from the available templates
2. Adjust target_count based on experience (beginners: fewer, advanced: more)
3. Personalize descriptions with specific targets (duration, intensity)
4. Include fallbacks for each action
5. Don't overload beginners - max 3-4 actions for phase 1
6. Respect constraints absolutely
7. Match actions to available equipment`
}

/**
 * Validate AI response and build protocol object
 */
function validateAndBuildProtocol(
  parsed: Record<string, unknown>,
  template: DomainTemplate,
  context: PersonalizationContext
): PersonalizedProtocol {
  const focusSummary = (parsed.focus_summary as string) || template.preview
  const rawActions = (parsed.actions as Array<Record<string, unknown>>) || []

  const actions: PersonalizedAction[] = rawActions.map((a, i) => ({
    templateId: String(a.template_id || ''),
    title: String(a.title || ''),
    description: String(a.description || ''),
    type: 'action' as const,
    targetCount: Number(a.target_count) || 1,
    targetValue: a.target_value ? String(a.target_value) : undefined,
    successCriteria: a.success_criteria ? String(a.success_criteria) : undefined,
    fallback: a.fallback ? String(a.fallback) : undefined,
    phase: 1,
  }))

  // Calculate phase dates
  const phases: PersonalizedPhase[] = template.phases.map((p, i) => ({
    number: p.number,
    name: p.name,
    durationWeeks: p.durationWeeks,
    focus: p.focus,
    successCriteria: p.successCriteria,
    targetDate: calculatePhaseEndDate(i, template.phases.map(pp => ({
      ...pp,
      targetDate: undefined,
    }))),
  }))

  return {
    templateId: template.id,
    templateVersion: template.version,
    personalization: context,
    focusSummary,
    phases,
    actions,
    enabledModules: [],
  }
}

/**
 * Build default protocol without AI (fallback)
 */
function buildDefaultProtocol(
  template: DomainTemplate,
  context: PersonalizationContext
): PersonalizedProtocol {
  const phaseActions = getActionTemplatesForPhase(template.id, 1)

  // Select actions based on experience level
  const maxActions = context.experienceLevel === 'beginner' ? 3 : 
                     context.experienceLevel === 'intermediate' ? 5 : 6
  const selectedActions = phaseActions.slice(0, maxActions)

  const actions: PersonalizedAction[] = selectedActions.map(a => ({
    templateId: a.id,
    title: a.title,
    description: a.description,
    type: a.type,
    targetCount: adjustTargetCount(a.defaultSchedule.targetCount, context.experienceLevel),
    targetValue: a.successCriteria,
    successCriteria: a.successCriteria,
    fallback: a.fallback,
    phase: 1,
  }))

  const phases: PersonalizedPhase[] = template.phases.map((p, i) => ({
    number: p.number,
    name: p.name,
    durationWeeks: p.durationWeeks,
    focus: p.focus,
    successCriteria: p.successCriteria,
    targetDate: calculatePhaseEndDate(i, template.phases.map(pp => ({
      ...pp,
      targetDate: undefined,
    }))),
  }))

  return {
    templateId: template.id,
    templateVersion: template.version,
    personalization: context,
    focusSummary: template.preview,
    phases,
    actions,
    enabledModules: [],
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function determineExperienceLevel(
  domain: PrimeDomain,
  answers: Record<string, unknown>
): 'beginner' | 'intermediate' | 'advanced' {
  // Domain-specific experience questions
  const experienceKeys: Record<PrimeDomain, string> = {
    heart: 'cardio_experience',
    frame: 'strength_experience',
    metabolism: 'cooking_ability', // Proxy for nutrition awareness
    recovery: 'sleep_tracker', // Having a tracker suggests awareness
    mind: 'meditation_experience',
  }

  const key = experienceKeys[domain]
  const answer = answers[key] as string | undefined

  if (!answer) return 'beginner'

  // Map answers to experience levels
  const beginnerAnswers = ['none', 'never', 'sedentary', 'minimal', 'no_kitchen']
  const intermediateAnswers = ['beginner', 'occasional', 'tried', 'can_cook', 'moderate']
  const advancedAnswers = ['intermediate', 'advanced', 'regular', 'trained', 'love_cooking']

  if (beginnerAnswers.includes(answer)) return 'beginner'
  if (advancedAnswers.includes(answer)) return 'advanced'
  return 'intermediate'
}

function extractEquipment(answers: Record<string, unknown>): string[] {
  const equipment: string[] = []

  // Frame equipment
  const gymAccess = answers.gym_access as string
  if (gymAccess === 'full_gym') {
    equipment.push('full gym', 'barbells', 'dumbbells', 'machines')
  } else if (gymAccess === 'home_gym') {
    equipment.push('dumbbells', 'pull-up bar', 'bench')
  } else if (gymAccess === 'minimal') {
    equipment.push('resistance bands', 'bodyweight')
  }

  // Heart equipment
  if (answers.hr_monitor) {
    equipment.push('heart rate monitor')
  }

  // Recovery equipment
  const tracker = answers.sleep_tracker as string
  if (tracker && tracker !== 'none') {
    equipment.push('sleep tracker')
  }

  return equipment
}

function extractPreferences(answers: Record<string, unknown>): string[] {
  const preferences: string[] = []

  // Cardio preferences
  const cardioPrefs = answers.cardio_preference as string[] | string
  if (Array.isArray(cardioPrefs)) {
    preferences.push(...cardioPrefs)
  } else if (cardioPrefs) {
    preferences.push(cardioPrefs)
  }

  // Indoor/outdoor preference
  const location = answers.indoor_outdoor as string
  if (location) {
    preferences.push(`prefers ${location}`)
  }

  // Diet style
  const diet = answers.diet_style as string
  if (diet) {
    preferences.push(`diet: ${diet}`)
  }

  return preferences
}

function adjustTargetCount(baseCount: number, level: 'beginner' | 'intermediate' | 'advanced'): number {
  if (level === 'beginner') {
    return Math.max(1, Math.floor(baseCount * 0.7))
  }
  if (level === 'advanced') {
    return Math.ceil(baseCount * 1.2)
  }
  return baseCount
}

function calculatePhaseEndDate(phaseIndex: number, phases: Array<{ durationWeeks: number }>): string {
  const startDate = new Date()
  let weeksFromNow = 0

  for (let i = 0; i <= phaseIndex; i++) {
    weeksFromNow += phases[i].durationWeeks
  }

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + weeksFromNow * 7)
  return endDate.toISOString().slice(0, 10)
}

function getScheduleString(targetCount: number): string {
  if (targetCount >= 7) return 'daily'
  if (targetCount === 6) return '6x/week'
  if (targetCount === 5) return '5x/week'
  if (targetCount === 4) return '4x/week'
  if (targetCount === 3) return '3x/week'
  if (targetCount === 2) return '2x/week'
  if (targetCount === 1) return 'weekly'
  return 'once'
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

