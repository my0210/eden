/**
 * Extract information from chat messages
 * 
 * Returns PATCHES, not rewrites. Atomic operations only.
 * Used after each message to update memory and trigger actions.
 */

import OpenAI from 'openai'
import { LLM_MODELS } from '@/lib/llm/models'
import { MemoryPatches, StatedFact, NotableEvent, InferredPattern } from './memory'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================================================
// Types
// ============================================================================

export interface GoalData {
  target_description: string
  goal_type: 'outcome' | 'domain' | 'composite'
  domain?: string
  duration_weeks: number
  baseline_value?: number
  target_value?: number
  constraints?: string[]
}

export interface ExtractionResult {
  patches: MemoryPatches
  actions: {
    createGoal?: GoalData
    completeAction?: { actionTitle: string }
    updateConstraints?: string[]
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract information from recent messages and Eden's response
 * Returns patches for memory updates and any actions to take
 */
export async function extractFromChat(
  messages: Message[],
  edenResponse: string,
  currentGoalTitle?: string
): Promise<ExtractionResult> {
  // Get recent conversation context (last 6 messages)
  const recentMessages = messages.slice(-6)
  const conversationText = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Eden'}: ${m.content}`)
    .join('\n\n')

  const prompt = `Analyze this conversation and extract any new information.

CONVERSATION:
${conversationText}

EDEN'S LATEST RESPONSE:
${edenResponse}

${currentGoalTitle ? `CURRENT GOAL: ${currentGoalTitle}` : 'NO ACTIVE GOAL'}

Extract the following as JSON:

{
  "stated_facts": [
    // New facts the user stated (injuries, preferences, life context)
    // Only include if explicitly stated, not inferred
    // Example: { "fact": "Works from home on Fridays", "source": "chat" }
  ],
  
  "notable_events": [
    // Achievements, milestones, or significant moments
    // Example: { "description": "Completed first 2K run", "source": "chat" }
  ],
  
  "inferred_patterns": [
    // Patterns you notice (be conservative - these may be wrong)
    // Only include if there's strong evidence across multiple messages
    // Example: { "pattern": "Skips workouts when work is stressful" }
  ],
  
  "goal_intent": null or {
    // If user expresses clear intent to commit to a goal
    "target_description": "Run a 5K without stopping",
    "goal_type": "outcome",  // or "domain" or "composite"
    "domain": "cardio",  // optional
    "duration_weeks": 8,
    "constraints": ["knee injury", "no gym access"]  // optional
  },
  
  "action_completed": null or {
    // If user mentions completing a specific action
    "action_title": "Walk-run intervals 3x this week"
  },
  
  "new_constraints": [
    // New limitations or restrictions mentioned
    // Example: "Can't do high impact due to knee"
  ],
  
  "contradictions": [
    // Facts that contradict previous stated facts (to remove)
    // Example: "Actually I do have gym access now"
  ]
}

Rules:
- Only extract explicitly stated information
- Be conservative with inferred patterns
- Don't duplicate facts already likely known
- Focus on actionable, relevant information
- Return empty arrays if nothing to extract

Return ONLY valid JSON.`

  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODELS.STANDARD,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,  // Low temp for consistent extraction
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return emptyResult()
    }

    const extracted = JSON.parse(content)
    return buildResultFromExtraction(extracted)

  } catch (error) {
    console.error('Extraction failed:', error)
    return emptyResult()
  }
}

// ============================================================================
// Helpers
// ============================================================================

function emptyResult(): ExtractionResult {
  return {
    patches: {},
    actions: {}
  }
}

function buildResultFromExtraction(extracted: Record<string, unknown>): ExtractionResult {
  const patches: MemoryPatches = {}
  const actions: ExtractionResult['actions'] = {}

  // Stated facts
  const statedFacts = extracted.stated_facts as Array<{ fact: string; source?: string }> | undefined
  if (statedFacts?.length) {
    patches.add_stated = statedFacts.map(f => ({
      fact: f.fact,
      date: new Date().toISOString(),
      source: (f.source || 'chat') as StatedFact['source']
    }))
  }

  // Notable events
  const events = extracted.notable_events as Array<{ description: string; source?: string }> | undefined
  if (events?.length) {
    patches.add_events = events.map(e => ({
      date: new Date().toISOString(),
      description: e.description,
      source: (e.source || 'chat') as NotableEvent['source']
    }))
  }

  // Inferred patterns
  const patterns = extracted.inferred_patterns as Array<{ pattern: string }> | undefined
  if (patterns?.length) {
    patches.add_inferred = patterns.map(p => ({
      pattern: p.pattern,
      confidence: 'low' as const,
      observed_at: new Date().toISOString()
    }))
  }

  // Contradictions (facts to remove)
  const contradictions = extracted.contradictions as string[] | undefined
  if (contradictions?.length) {
    patches.remove_stated = contradictions
  }

  // Goal intent
  const goalIntent = extracted.goal_intent as GoalData | null | undefined
  if (goalIntent && goalIntent.target_description) {
    actions.createGoal = {
      target_description: goalIntent.target_description,
      goal_type: goalIntent.goal_type || 'outcome',
      domain: goalIntent.domain,
      duration_weeks: goalIntent.duration_weeks || 8,
      baseline_value: goalIntent.baseline_value,
      target_value: goalIntent.target_value,
      constraints: goalIntent.constraints
    }
  }

  // Action completed
  const actionCompleted = extracted.action_completed as { action_title: string } | null | undefined
  if (actionCompleted?.action_title) {
    actions.completeAction = {
      actionTitle: actionCompleted.action_title
    }
  }

  // New constraints
  const newConstraints = extracted.new_constraints as string[] | undefined
  if (newConstraints?.length) {
    actions.updateConstraints = newConstraints
  }

  return { patches, actions }
}

/**
 * Quick check if user is expressing goal intent (without full extraction)
 */
export async function detectGoalIntent(userMessage: string): Promise<boolean> {
  const goalIndicators = [
    'i want to',
    'my goal is',
    'i\'d like to',
    'help me',
    'i need to',
    'let\'s do it',
    'ready to commit',
    'yes, let\'s',
    'sign me up',
    'i\'m in',
    'let\'s start',
    'ready to start'
  ]

  const lowerMessage = userMessage.toLowerCase()
  return goalIndicators.some(indicator => lowerMessage.includes(indicator))
}

/**
 * Quick check if user mentions completing something
 */
export function detectProgressMention(userMessage: string): boolean {
  const progressIndicators = [
    'did my',
    'completed',
    'finished',
    'done with',
    'just did',
    'got my',
    'crushed',
    'nailed',
    'knocked out'
  ]

  const lowerMessage = userMessage.toLowerCase()
  return progressIndicators.some(indicator => lowerMessage.includes(indicator))
}

