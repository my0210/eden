import { SupabaseClient } from '@supabase/supabase-js'
import { getUserSnapshot, UserSnapshot } from '@/lib/context/getUserSnapshot'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

You will receive:
1. A JSON snapshot of the user's current health metrics and profile.
2. A summary of their last weekly plan (if any).
3. Recent conversation messages (if any).

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
- Don't repeat the same actions from the last plan unless the user hasn't made progress.`

export async function createWeeklyPlanForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<EdenPlanResult> {
  // 1. Fetch snapshot
  let snapshot: UserSnapshot | null = null
  try {
    snapshot = await getUserSnapshot(supabase, userId)
  } catch (err) {
    console.error('Failed to get user snapshot:', err)
    throw new Error('SNAPSHOT_UNAVAILABLE')
  }

  if (!snapshot) {
    throw new Error('SNAPSHOT_UNAVAILABLE')
  }

  // 2. Fetch last plan (if any)
  const { data: lastPlans } = await supabase
    .from('eden_plans')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(1)

  const lastPlan = lastPlans?.[0] ?? null

  // 3. Fetch recent messages for context (guard against missing table)
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

  // 4. Build context for OpenAI
  const contextParts: string[] = []

  contextParts.push(`USER SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}`)

  if (lastPlan) {
    contextParts.push(`\nLAST WEEK'S PLAN (${lastPlan.start_date} to ${lastPlan.end_date}):\nFocus: ${lastPlan.focus_summary || 'Not specified'}\nStatus: ${lastPlan.status}`)
  } else {
    contextParts.push('\nNO PREVIOUS PLAN – this is their first weekly plan.')
  }

  if (recentMessages.length > 0) {
    const messageSummary = recentMessages
      .slice(0, 10)
      .reverse()
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`)
      .join('\n')
    contextParts.push(`\nRECENT CONVERSATION:\n${messageSummary}`)
  }

  // 5. Call OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
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

  // 6. Parse JSON response
  let parsed: LLMPlanOutput
  try {
    // Strip any markdown code blocks if present
    const cleanedResponse = llmResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    parsed = JSON.parse(cleanedResponse)
  } catch (parseErr) {
    console.error('Failed to parse LLM response:', llmResponse)
    throw new Error('LLM_INVALID_JSON')
  }

  if (!parsed.focusSummary || !Array.isArray(parsed.actions)) {
    throw new Error('LLM_INVALID_STRUCTURE')
  }

  // 7. Calculate dates
  const startDate = new Date()
  const endDate = addDays(startDate, 7)
  const startDateStr = formatDateForSupabase(startDate)
  const endDateStr = formatDateForSupabase(endDate)

  // 8. Insert into eden_plans
  const { data: newPlan, error: planError } = await supabase
    .from('eden_plans')
    .insert({
      user_id: userId,
      snapshot_id: null, // We don't store snapshot separately for now
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
      // Don't throw – plan was created, just log the error
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

