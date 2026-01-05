/**
 * Eden User Memory - Structured memory with confidence layers
 * 
 * Prevents hallucination by grounding everything in sourced data.
 * Updates are patches, not rewrites.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface PrimeCheckData {
  name?: string
  age?: number
  sex?: string
  height?: number
  weight?: number
  location?: string
  occupation?: string
  self_ratings?: Record<string, number>
  stated_goals?: string[]
}

export interface BodyPhotoData {
  current?: {
    date: string
    body_fat_estimate?: number
    posture_notes?: string
    analysis_notes?: string
  }
  baseline?: {
    date: string
    body_fat_estimate?: number
    posture_notes?: string
  }
  trend?: string
}

export interface LabData {
  current?: {
    date: string
    vitamin_d?: { value: number; unit: string; status: string }
    cholesterol?: { value: number; unit: string; status: string }
    glucose?: { value: number; unit: string; status: string }
    [key: string]: unknown
  }
  previous?: {
    date: string
    [key: string]: unknown
  }
  trend?: string
}

export interface AppleHealthData {
  current?: {
    rhr?: number
    sleep_avg?: number
    steps_avg?: number
    hrv_avg?: number
    [key: string]: unknown
  }
  baseline?: {
    rhr?: number
    sleep_avg?: number
    steps_avg?: number
    hrv_avg?: number
    [key: string]: unknown
  }
  trend?: {
    rhr?: string
    sleep?: string
    steps?: string
    hrv?: string
  }
}

export interface ProtocolData {
  goal_id?: string
  goal_title?: string
  goal_type?: string
  duration_weeks?: number
  started_at?: string
  current_week?: number
  current_phase?: number
  total_phases?: number
  actions_done?: number
  actions_total?: number
  milestones_achieved?: number
  milestones_total?: number
}

export interface ConfirmedData {
  prime_check?: PrimeCheckData
  body_photos?: BodyPhotoData
  labs?: LabData
  apple_health?: AppleHealthData
  protocol?: ProtocolData
}

export interface StatedFact {
  fact: string
  date: string
  source: 'chat' | 'prime_check' | 'onboarding'
}

export interface InferredPattern {
  pattern: string
  confidence?: 'low' | 'medium' | 'high'
  observed_at?: string
}

export interface NotableEvent {
  date: string
  description: string
  source: 'protocol' | 'chat' | 'apple_health' | 'labs' | 'photos' | 'onboarding' | 'decision_log'
}

export interface UserMemory {
  id: string
  user_id: string
  confirmed: ConfirmedData
  stated: StatedFact[]
  inferred: InferredPattern[]
  notable_events: NotableEvent[]
  baseline_snapshot: ConfirmedData | null
  baseline_date: string | null
  created_at: string
  updated_at: string
}

// Patches for atomic updates
export interface MemoryPatches {
  add_stated?: StatedFact[]
  remove_stated?: string[]  // by fact text match
  add_events?: NotableEvent[]
  update_confirmed?: Record<string, unknown>  // dot notation paths
  add_inferred?: InferredPattern[]
  remove_inferred?: string[]  // by pattern text match
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get user memory, returns null if not found
 */
export async function getMemory(
  supabase: SupabaseClient,
  userId: string
): Promise<UserMemory | null> {
  const { data, error } = await supabase
    .from('eden_user_memory')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to get memory:', error)
    return null
  }

  return data as UserMemory | null
}

/**
 * Get or create user memory (ensures memory exists)
 */
export async function getOrCreateMemory(
  supabase: SupabaseClient,
  userId: string
): Promise<UserMemory> {
  const existing = await getMemory(supabase, userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('eden_user_memory')
    .insert({
      user_id: userId,
      confirmed: {},
      stated: [],
      inferred: [],
      notable_events: []
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create memory:', error)
    throw new Error('Failed to create user memory')
  }

  return data as UserMemory
}

// ============================================================================
// Write Operations (Patches, not rewrites)
// ============================================================================

/**
 * Apply patches to memory - atomic operations only
 */
export async function applyMemoryPatches(
  supabase: SupabaseClient,
  userId: string,
  patches: MemoryPatches
): Promise<UserMemory | null> {
  // Get current memory
  const memory = await getOrCreateMemory(supabase, userId)

  // Build updated arrays
  let updatedStated = [...memory.stated]
  let updatedInferred = [...memory.inferred]
  let updatedEvents = [...memory.notable_events]
  let updatedConfirmed = { ...memory.confirmed }

  // Add stated facts (dedupe by fact text)
  if (patches.add_stated?.length) {
    const existingFacts = new Set(updatedStated.map(s => s.fact.toLowerCase().trim()))
    const newFacts = patches.add_stated.filter(
      s => !existingFacts.has(s.fact.toLowerCase().trim())
    )
    updatedStated = [...updatedStated, ...newFacts]
  }

  // Remove stated facts by text match
  if (patches.remove_stated?.length) {
    const removeSet = new Set(patches.remove_stated.map(s => s.toLowerCase()))
    updatedStated = updatedStated.filter(s => !removeSet.has(s.fact.toLowerCase()))
  }

  // Add events
  if (patches.add_events?.length) {
    updatedEvents = [...updatedEvents, ...patches.add_events]
    // Sort by date descending (newest first)
    updatedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  // Add inferred patterns (dedupe by pattern text)
  if (patches.add_inferred?.length) {
    const existingPatterns = new Set(updatedInferred.map(p => p.pattern.toLowerCase().trim()))
    const newPatterns = patches.add_inferred.filter(
      p => !existingPatterns.has(p.pattern.toLowerCase().trim())
    )
    updatedInferred = [...updatedInferred, ...newPatterns]
  }

  // Remove inferred by text match
  if (patches.remove_inferred?.length) {
    const removeSet = new Set(patches.remove_inferred.map(s => s.toLowerCase()))
    updatedInferred = updatedInferred.filter(p => !removeSet.has(p.pattern.toLowerCase()))
  }

  // Update confirmed with dot notation paths
  if (patches.update_confirmed) {
    updatedConfirmed = applyDotNotationUpdates(updatedConfirmed, patches.update_confirmed)
  }

  // Save updates
  const { data, error } = await supabase
    .from('eden_user_memory')
    .update({
      confirmed: updatedConfirmed,
      stated: updatedStated,
      inferred: updatedInferred,
      notable_events: updatedEvents
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Failed to apply memory patches:', error)
    return null
  }

  return data as UserMemory
}

/**
 * Update confirmed data directly (for bulk updates from data sources)
 */
export async function updateConfirmed(
  supabase: SupabaseClient,
  userId: string,
  section: keyof ConfirmedData,
  data: unknown
): Promise<UserMemory | null> {
  const memory = await getOrCreateMemory(supabase, userId)
  
  const updatedConfirmed = {
    ...memory.confirmed,
    [section]: data
  }

  const { data: updated, error } = await supabase
    .from('eden_user_memory')
    .update({ confirmed: updatedConfirmed })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update confirmed:', error)
    return null
  }

  return updated as UserMemory
}

/**
 * Add a notable event
 */
export async function addNotableEvent(
  supabase: SupabaseClient,
  userId: string,
  event: NotableEvent
): Promise<void> {
  await applyMemoryPatches(supabase, userId, {
    add_events: [event]
  })
}

/**
 * Add a stated fact
 */
export async function addStatedFact(
  supabase: SupabaseClient,
  userId: string,
  fact: string,
  source: StatedFact['source'] = 'chat'
): Promise<void> {
  await applyMemoryPatches(supabase, userId, {
    add_stated: [{
      fact,
      date: new Date().toISOString(),
      source
    }]
  })
}

/**
 * Set baseline snapshot (called when goal is created)
 */
export async function setBaselineSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const memory = await getOrCreateMemory(supabase, userId)

  const { error } = await supabase
    .from('eden_user_memory')
    .update({
      baseline_snapshot: memory.confirmed,
      baseline_date: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to set baseline:', error)
  }
}

/**
 * Clear all memory for a user
 */
export async function clearMemory(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('eden_user_memory')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to clear memory:', error)
  }
}

/**
 * Remove a specific stated fact
 */
export async function removeStatedFact(
  supabase: SupabaseClient,
  userId: string,
  factText: string
): Promise<void> {
  await applyMemoryPatches(supabase, userId, {
    remove_stated: [factText]
  })
}

/**
 * Remove a specific inferred pattern
 */
export async function removeInferredPattern(
  supabase: SupabaseClient,
  userId: string,
  patternText: string
): Promise<void> {
  await applyMemoryPatches(supabase, userId, {
    remove_inferred: [patternText]
  })
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Apply dot notation updates to an object
 * e.g., { "protocol.actions_done": 5 } updates confirmed.protocol.actions_done
 */
function applyDotNotationUpdates(
  obj: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(obj)) // deep clone

  for (const [path, value] of Object.entries(updates)) {
    const keys = path.split('.')
    let current: Record<string, unknown> = result

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key] as Record<string, unknown>
    }

    current[keys[keys.length - 1]] = value
  }

  return result
}

