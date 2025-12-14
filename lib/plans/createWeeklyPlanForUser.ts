import { SupabaseClient } from '@supabase/supabase-js'
import { buildEdenContext } from '@/lib/context/buildEdenContext'
import OpenAI from 'openai'

// Lazy initialization to avoid build-time errors when env var isn't set
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

export type EdenPlanAction = {
  title: string
  description?: string
  metricCode?: string
  targetValue?: string
  cadence?: string
}

export type EdenPlanResult = {
  planId: string
  focusSummary: string
  startDate: string
  endDate: string
  actions: EdenPlanAction[]
}

type LLMPlanOutput = {
  focusSummary: string
  actions: Array<{
    title: string
    description?: string
    metricCode?: string
    targetValue?: string
    cadence?: string
  }>
}

function formatDateForSupabase(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const PLAN_SYSTEM_PROMPT = `You are Eden, a health & performance coach focused on extending primespan – the years a person feels and performs at their best.

You will receive EDEN_CONTEXT with:
- profile: user's basic info (age, sex, height, weight, goals, constraints)
- metricsContext: current health metrics across heart, frame, metabolism, recovery, mind
- plan: previous plan if any (will be null for first-time users)

Your job is to create a focused weekly plan with 3-5 concrete actions.

IMPORTANT: Respond with ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "focusSummary": "1-2 sentences describing this week's main focus area",
  "actions": [
    {
      "title": "Short imperative action title",
      "description": "1-3 sentence explanation of why this matters and how to do it",
      "metricCode": "optional metric_code if this action targets a specific metric",
      "targetValue": "optional human-readable target like '7+ hours' or '3x this week'",
      "cadence": "e.g. daily, 3x/week, once"
    }
  ]
}

Guidelines:
- Focus on what will have the biggest impact given their current metrics.
- Actions should be specific, measurable, and achievable in one week.
- If recovery or sleep metrics are lagging, prioritize those – they amplify everything else.
- Keep the tone direct and encouraging, not clinical.
- If this is their first plan, start simple with 3 foundational habits.`

export async function createWeeklyPlanForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<EdenPlanResult> {
  // 1. Build context using the shared helper
  const { edenContext } = await buildEdenContext(supabase, userId)

  // Check if we have enough context to create a plan
  // Need at least essentials OR a scorecard OR profile data
  const hasEssentials = edenContext.essentials.age || edenContext.essentials.sex_at_birth
  const hasScorecard = edenContext.hasScorecard
  const hasProfile = !!edenContext.profile
  
  if (!hasEssentials && !hasScorecard && !hasProfile) {
    throw new Error('CONTEXT_UNAVAILABLE')
  }

  // 2. Fetch recent messages for additional context
  let recentMessages: Array<{ role: string; content: string; created_at: string }> = []
  try {
    const { data: messages } = await supabase
      .from('eden_messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (messages) {
      recentMessages = messages
    }
  } catch {
    // Table might not exist or other error – continue without messages
  }

  // 3. Build context string for OpenAI
  const contextParts: string[] = []
  contextParts.push(`EDEN_CONTEXT: ${JSON.stringify(edenContext)}`)

  if (recentMessages.length > 0) {
    const messageSummary = recentMessages
      .slice(0, 10)
      .reverse()
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`)
      .join('\n')
    contextParts.push(`\nRECENT CONVERSATION:\n${messageSummary}`)
  }

  // 4. Call OpenAI
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PLAN_SYSTEM_PROMPT },
      { role: 'user', content: contextParts.join('\n\n') },
    ],
    temperature: 0.7,
  })

  const llmResponse = completion.choices[0]?.message?.content
  if (!llmResponse) {
    throw new Error('LLM_NO_RESPONSE')
  }

  // 5. Parse JSON response
  let parsed: LLMPlanOutput
  try {
    parsed = JSON.parse(llmResponse)
  } catch (parseErr) {
    console.error('Failed to parse LLM response:', llmResponse)
    throw new Error('LLM_INVALID_JSON')
  }

  if (!parsed.focusSummary || !Array.isArray(parsed.actions)) {
    throw new Error('LLM_INVALID_STRUCTURE')
  }

  // 6. Calculate dates
  const startDate = new Date()
  const endDate = addDays(startDate, 7)
  const startDateStr = formatDateForSupabase(startDate)
  const endDateStr = formatDateForSupabase(endDate)

  // 7. Mark any existing active plans as completed
  await supabase
    .from('eden_plans')
    .update({ status: 'completed' })
    .eq('user_id', userId)
    .eq('status', 'active')

  // 8. Insert into eden_plans
  const { data: newPlan, error: planError } = await supabase
    .from('eden_plans')
    .insert({
      user_id: userId,
      snapshot_id: null,
      start_date: startDateStr,
      end_date: endDateStr,
      status: 'active',
      focus_summary: parsed.focusSummary,
      llm_raw: {
        model: 'gpt-4.1-mini',
        response: parsed,
        generated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single()

  if (planError || !newPlan) {
    console.error('Failed to insert plan:', planError)
    throw new Error('DB_INSERT_PLAN_FAILED')
  }

  const planId = newPlan.id

  // 9. Insert actions into eden_plan_actions
  const actionsToInsert = parsed.actions.map((action, index) => ({
    plan_id: planId,
    priority: index + 1,
    title: action.title,
    description: action.description || null,
    metric_code: action.metricCode || null,
    target_value: action.targetValue || null,
    cadence: action.cadence || null,
  }))

  if (actionsToInsert.length > 0) {
    const { error: actionsError } = await supabase
      .from('eden_plan_actions')
      .insert(actionsToInsert)

    if (actionsError) {
      console.error('Failed to insert plan actions:', actionsError)
    }
  }

  // 10. Return result
  return {
    planId,
    focusSummary: parsed.focusSummary,
    startDate: startDateStr,
    endDate: endDateStr,
    actions: parsed.actions.map((a) => ({
      title: a.title,
      description: a.description,
      metricCode: a.metricCode,
      targetValue: a.targetValue,
      cadence: a.cadence,
    })),
  }
}
