/**
 * Goal Extraction from Conversation
 * 
 * Uses LLM to extract structured goal information from user messages.
 * Called when Eden detects goal-setting intent in the conversation.
 */

import OpenAI from 'openai'
import { ExtractedGoal, GoalType, GoalConstraints } from './types'
import { PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types'

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

const GOAL_EXTRACTION_PROMPT = `You are analyzing a conversation to extract a health/fitness goal.

Given the conversation context, extract the goal details in JSON format.

GOAL TYPES:
- "domain": Improve a specific health domain (heart, frame, metabolism, recovery, mind)
- "outcome": Achieve a specific outcome (run a 5K, do 10 pull-ups, lose 10 lbs)
- "composite": Improve overall Prime Score

DOMAINS (only for domain goals):
- heart: cardio, VO2max, resting heart rate, blood pressure
- frame: strength, body composition, body fat, muscle
- metabolism: blood sugar, HbA1c, metabolic health
- recovery: sleep, HRV, stress
- mind: focus, cognition, mental clarity

Respond with ONLY valid JSON in this exact format:
{
  "goal_type": "domain" | "outcome" | "composite",
  "domain": "heart" | "frame" | "metabolism" | "recovery" | "mind" | null,
  "target_description": "Clear, specific description of the goal",
  "target_metric_code": "metric code if applicable (e.g., 'vo2max', 'body_fat') or null",
  "target_value": number or null,
  "duration_weeks": number (suggested duration, 4-12 weeks typical),
  "constraints": {
    "injuries": ["any injuries mentioned"],
    "time_restrictions": ["any time restrictions"],
    "equipment_limitations": ["any equipment limitations"],
    "red_lines": ["things user explicitly said they won't do"],
    "other": ["other relevant constraints"]
  },
  "confidence": 0.0 to 1.0 (how confident you are in this extraction)
}

If you cannot extract a clear goal, return:
{
  "goal_type": null,
  "target_description": null,
  "confidence": 0.0,
  "missing": ["what information is needed"]
}

Guidelines:
- Be specific in target_description
- Only include constraints that were explicitly mentioned
- Set confidence based on how clear and complete the goal is
- Duration should be realistic for the goal type`

export interface GoalExtractionResult {
  success: boolean
  goal?: ExtractedGoal
  missing?: string[]
  raw_response?: string
}

export interface ConversationContext {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  user_essentials?: {
    age?: number
    sex_at_birth?: string
    weight?: number
    height?: number
  }
  current_scorecard?: {
    prime_score: number | null
    domain_scores: Record<string, number | null>
  }
}

/**
 * Extract goal details from conversation context
 */
export async function extractGoalFromConversation(
  context: ConversationContext
): Promise<GoalExtractionResult> {
  // Build context string
  const contextParts: string[] = []
  
  // Add user essentials if available
  if (context.user_essentials) {
    const essentials = context.user_essentials
    const essentialBits: string[] = []
    if (essentials.age) essentialBits.push(`${essentials.age} years old`)
    if (essentials.sex_at_birth) essentialBits.push(essentials.sex_at_birth)
    if (essentials.weight) essentialBits.push(`${essentials.weight}kg`)
    if (essentials.height) essentialBits.push(`${essentials.height}cm`)
    if (essentialBits.length > 0) {
      contextParts.push(`User: ${essentialBits.join(', ')}`)
    }
  }
  
  // Add scorecard if available
  if (context.current_scorecard) {
    const sc = context.current_scorecard
    if (sc.prime_score !== null) {
      contextParts.push(`Current Prime Score: ${sc.prime_score}`)
    }
    const domainScores = Object.entries(sc.domain_scores)
      .filter(([, score]) => score !== null)
      .map(([domain, score]) => `${domain}: ${score}`)
    if (domainScores.length > 0) {
      contextParts.push(`Domain scores: ${domainScores.join(', ')}`)
    }
  }
  
  // Add conversation
  contextParts.push('\nConversation:')
  for (const msg of context.messages) {
    contextParts.push(`${msg.role.toUpperCase()}: ${msg.content}`)
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: GOAL_EXTRACTION_PROMPT },
        { role: 'user', content: contextParts.join('\n') },
      ],
      temperature: 0.3, // Lower temperature for more consistent extraction
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      return { success: false, missing: ['LLM did not respond'] }
    }

    const parsed = JSON.parse(responseText)
    
    // Check if extraction failed
    if (parsed.goal_type === null || parsed.confidence < 0.3) {
      return {
        success: false,
        missing: parsed.missing || ['Goal details are unclear'],
        raw_response: responseText,
      }
    }

    // Validate goal type
    const validGoalTypes: GoalType[] = ['domain', 'outcome', 'composite']
    if (!validGoalTypes.includes(parsed.goal_type)) {
      return { success: false, missing: ['Invalid goal type'] }
    }

    // Validate domain if domain goal
    if (parsed.goal_type === 'domain' && parsed.domain) {
      if (!PRIME_DOMAINS.includes(parsed.domain as PrimeDomain)) {
        return { success: false, missing: ['Invalid domain'] }
      }
    }

    // Build extracted goal
    const extractedGoal: ExtractedGoal = {
      goal_type: parsed.goal_type as GoalType,
      domain: parsed.domain as PrimeDomain | undefined,
      target_description: parsed.target_description,
      target_metric_code: parsed.target_metric_code || undefined,
      target_value: parsed.target_value || undefined,
      duration_weeks: parsed.duration_weeks || 8, // Default to 8 weeks
      constraints: normalizeConstraints(parsed.constraints),
      confidence: parsed.confidence,
    }

    return {
      success: true,
      goal: extractedGoal,
      raw_response: responseText,
    }
  } catch (error) {
    console.error('Goal extraction failed:', error)
    return {
      success: false,
      missing: ['Failed to extract goal from conversation'],
    }
  }
}

/**
 * Normalize constraints object, removing empty arrays
 */
function normalizeConstraints(raw: Record<string, unknown> | undefined): GoalConstraints {
  if (!raw) return {}
  
  const constraints: GoalConstraints = {}
  
  if (Array.isArray(raw.injuries) && raw.injuries.length > 0) {
    constraints.injuries = raw.injuries.filter((s): s is string => typeof s === 'string')
  }
  if (Array.isArray(raw.time_restrictions) && raw.time_restrictions.length > 0) {
    constraints.time_restrictions = raw.time_restrictions.filter((s): s is string => typeof s === 'string')
  }
  if (Array.isArray(raw.equipment_limitations) && raw.equipment_limitations.length > 0) {
    constraints.equipment_limitations = raw.equipment_limitations.filter((s): s is string => typeof s === 'string')
  }
  if (Array.isArray(raw.red_lines) && raw.red_lines.length > 0) {
    constraints.red_lines = raw.red_lines.filter((s): s is string => typeof s === 'string')
  }
  if (Array.isArray(raw.other) && raw.other.length > 0) {
    constraints.other = raw.other.filter((s): s is string => typeof s === 'string')
  }
  
  return constraints
}

/**
 * Detect if a message contains goal-setting intent
 */
export function detectGoalIntent(message: string): boolean {
  const goalPatterns = [
    /i want to/i,
    /i('d)? like to/i,
    /help me/i,
    /my goal is/i,
    /i('m)? trying to/i,
    /i need to/i,
    /can you help me/i,
    /improve my/i,
    /get better at/i,
    /work on my/i,
    /focus on/i,
    /let's work on/i,
    /lose weight/i,
    /gain muscle/i,
    /sleep better/i,
    /run a/i,
    /do \d+ (push-?ups|pull-?ups|squats)/i,
    /lower my/i,
    /increase my/i,
    /boost my/i,
  ]
  
  return goalPatterns.some(pattern => pattern.test(message))
}

