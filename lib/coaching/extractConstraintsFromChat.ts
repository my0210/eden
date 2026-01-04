/**
 * Constraint Extraction from Chat
 * 
 * Detects and extracts constraints mentioned during ongoing conversation.
 * Updates goal-specific constraints when user mentions injuries, limitations, etc.
 */

import OpenAI from 'openai'
import { GoalConstraints } from './types'

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

const CONSTRAINT_EXTRACTION_PROMPT = `You are analyzing a user message to detect any health/fitness constraints or limitations they mentioned.

Look for:
- Injuries (e.g., "my knee hurts", "I have back pain", "shoulder injury")
- Time restrictions (e.g., "I can't do mornings", "only have 30 minutes", "busy on weekends")
- Equipment limitations (e.g., "no gym", "home workouts only", "no weights")
- Red lines / things they won't do (e.g., "I hate running", "no fasting", "don't want to track calories")
- Other constraints (e.g., "traveling next week", "limited mobility")

If the message contains any constraints, respond with JSON:
{
  "found_constraints": true,
  "constraints": {
    "injuries": ["list of injuries"],
    "time_restrictions": ["list of time restrictions"],
    "equipment_limitations": ["list of equipment limitations"],
    "red_lines": ["things they explicitly won't do"],
    "other": ["other constraints"]
  }
}

If no constraints are found, respond with:
{
  "found_constraints": false
}

Only extract constraints that are EXPLICITLY mentioned. Do not infer or assume constraints.`

export interface ConstraintExtractionResult {
  found: boolean
  constraints?: GoalConstraints
}

/**
 * Extract constraints from a single message
 */
export async function extractConstraintsFromMessage(
  message: string
): Promise<ConstraintExtractionResult> {
  // Quick check: does the message likely contain constraints?
  if (!mightContainConstraints(message)) {
    return { found: false }
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CONSTRAINT_EXTRACTION_PROMPT },
        { role: 'user', content: message },
      ],
      temperature: 0.2,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      return { found: false }
    }

    const parsed = JSON.parse(responseText)
    
    if (!parsed.found_constraints) {
      return { found: false }
    }

    const constraints = normalizeConstraints(parsed.constraints)
    const hasAnyConstraints = Object.values(constraints).some(
      arr => Array.isArray(arr) && arr.length > 0
    )

    if (!hasAnyConstraints) {
      return { found: false }
    }

    return {
      found: true,
      constraints,
    }
  } catch (error) {
    console.error('Constraint extraction failed:', error)
    return { found: false }
  }
}

/**
 * Quick heuristic check if message might contain constraints
 * Avoids unnecessary LLM calls
 */
function mightContainConstraints(message: string): boolean {
  const constraintPatterns = [
    // Injuries
    /hurt|pain|injury|injured|sore|ache|strain|sprain/i,
    /bad (knee|back|shoulder|ankle|wrist|hip|neck)/i,
    /can't (lift|run|walk|squat|push|pull)/i,
    
    // Time restrictions
    /can't do (morning|evening|weekend|weekday)/i,
    /only have \d+ (minute|hour)/i,
    /no time (for|to)/i,
    /busy (on|in|during)/i,
    /not available/i,
    
    // Equipment
    /no gym|home only|at home|no equipment|no weights/i,
    /don't have (a |access to )/i,
    
    // Red lines
    /hate|refuse|won't|will not|never|don't want to/i,
    /no (fasting|running|cardio|dieting)/i,
    
    // Travel / temporary
    /traveling|trip|vacation|away/i,
    /next (week|month)/i,
    /limited/i,
  ]
  
  return constraintPatterns.some(pattern => pattern.test(message))
}

/**
 * Normalize constraints object
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
 * Merge new constraints into existing constraints
 * Deduplicates entries
 */
export function mergeConstraints(
  existing: GoalConstraints,
  newConstraints: GoalConstraints
): GoalConstraints {
  const merged: GoalConstraints = { ...existing }
  
  const keys: (keyof GoalConstraints)[] = [
    'injuries',
    'time_restrictions',
    'equipment_limitations',
    'red_lines',
    'other',
  ]
  
  for (const key of keys) {
    const existingArr = existing[key] || []
    const newArr = newConstraints[key] || []
    
    if (newArr.length > 0) {
      // Deduplicate by converting to lowercase for comparison
      const existingLower = new Set(existingArr.map(s => s.toLowerCase()))
      const toAdd = newArr.filter(s => !existingLower.has(s.toLowerCase()))
      
      if (toAdd.length > 0) {
        merged[key] = [...existingArr, ...toAdd]
      }
    }
  }
  
  return merged
}

