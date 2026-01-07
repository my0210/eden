/**
 * Initialize Memory from Onboarding
 * 
 * Seeds the memory with all data from Prime Check and uploads.
 * Called when user completes onboarding.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { 
  getOrCreateMemory, 
  ConfirmedData, 
  PrimeCheckData,
  AppleHealthData,
  LabData,
  BodyPhotoData,
  StatedFact,
  NotableEvent,
  DomainSelectionData
} from './memory'

// ============================================================================
// Main Initialization
// ============================================================================

/**
 * Initialize memory from onboarding data
 * Called when Prime Check is completed
 */
export async function initializeMemory(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  console.log('Initializing memory for user:', userId)

  // 1. Load user state (onboarding data) - including prime_check_json and coaching_json!
  const { data: userState } = await supabase
    .from('eden_user_state')
    .select('identity_json, goals_json, prime_check_json, coaching_json')
    .eq('user_id', userId)
    .maybeSingle()

  // 2. Load scorecard
  const { data: scorecardRow } = await supabase
    .from('eden_user_scorecards')
    .select('scorecard_json')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Load Apple Health data
  const appleHealthData = await loadAppleHealthData(supabase, userId)

  // 4. Load photo analysis
  const photoData = await loadPhotoAnalysis(supabase, userId)

  // 5. Load lab analysis
  const labData = await loadLabAnalysis(supabase, userId)

  // Build confirmed data
  const identity = userState?.identity_json || {}
  const goals = userState?.goals_json || {}
  const primeCheckAnswers = userState?.prime_check_json || {}
  const coachingData = userState?.coaching_json || {}
  const scorecard = scorecardRow?.scorecard_json

  const primeCheck: PrimeCheckData = {
    name: identity.name || identity.first_name,
    age: identity.age,
    sex: identity.sex_at_birth,
    height: identity.height,
    weight: identity.weight,
    location: identity.location || identity.city,
    occupation: identity.occupation,
    self_ratings: scorecard?.domain_scores || {},
    stated_goals: extractStatedGoals(goals)
  }

  // Extract rich details from Prime Check answers
  const statedFromPrimeCheck = extractStatedFromPrimeCheck(primeCheckAnswers)

  // Extract domain selection from coaching_json
  const domainSelectionRaw = coachingData.domain_selection as {
    primary?: string
    secondary?: string | null
    time_budget_hours?: number
    reasoning?: Record<string, string>
  } | undefined

  const domainSelection: DomainSelectionData | undefined = domainSelectionRaw?.primary
    ? {
        primary: domainSelectionRaw.primary,
        secondary: domainSelectionRaw.secondary,
        time_budget_hours: domainSelectionRaw.time_budget_hours || 5,
        reasoning: domainSelectionRaw.reasoning,
        selected_at: new Date().toISOString()
      }
    : undefined

  const confirmed: ConfirmedData = {
    prime_check: primeCheck,
    apple_health: appleHealthData,
    body_photos: photoData,
    labs: labData,
    protocol: undefined,  // No goal yet
    domain_selection: domainSelection
  }

  // Build stated facts from onboarding
  const stated: StatedFact[] = [...statedFromPrimeCheck]
  
  // Add goals as stated facts
  if (goals.focus_primary) {
    stated.push({
      fact: `Primary focus: ${goals.focus_primary}`,
      date: new Date().toISOString(),
      source: 'prime_check'
    })
  }
  if (goals.focus_secondary) {
    stated.push({
      fact: `Secondary focus: ${goals.focus_secondary}`,
      date: new Date().toISOString(),
      source: 'prime_check'
    })
  }

  // Notable events
  const events: NotableEvent[] = [{
    date: new Date().toISOString(),
    description: 'Completed Prime Check onboarding',
    source: 'onboarding'
  }]

  // If they uploaded data, note that
  if (appleHealthData) {
    events.push({
      date: new Date().toISOString(),
      description: 'Connected Apple Health data',
      source: 'apple_health'
    })
  }
  if (photoData) {
    events.push({
      date: new Date().toISOString(),
      description: 'Uploaded body photos for analysis',
      source: 'photos'
    })
  }
  if (labData) {
    events.push({
      date: new Date().toISOString(),
      description: 'Uploaded lab results',
      source: 'labs'
    })
  }

  // Create or update memory
  const memory = await getOrCreateMemory(supabase, userId)

  const { error } = await supabase
    .from('eden_user_memory')
    .update({
      confirmed,
      stated,
      inferred: [],
      notable_events: events,
      baseline_snapshot: confirmed,
      baseline_date: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to initialize memory:', error)
    throw new Error('Failed to initialize memory')
  }

  console.log('Memory initialized successfully')
}

// ============================================================================
// Data Loaders
// ============================================================================

async function loadAppleHealthData(
  supabase: SupabaseClient,
  userId: string
): Promise<AppleHealthData | undefined> {
  // Check if there's an Apple Health import
  const { data: ahImport } = await supabase
    .from('apple_health_imports')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'processed')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ahImport) return undefined

  // Load key metrics
  const { data: metrics } = await supabase
    .from('eden_health_metrics')
    .select('metric_key, value_raw, measured_at')
    .eq('user_id', userId)
    .in('metric_key', [
      'apple_health_resting_heart_rate',
      'apple_health_sleep_duration',
      'apple_health_step_count',
      'apple_health_hrv'
    ])
    .order('measured_at', { ascending: false })

  if (!metrics?.length) return undefined

  // Get most recent values
  const getLatest = (key: string) => {
    const metric = metrics.find(m => m.metric_key === key)
    return metric?.value_raw
  }

  const current = {
    rhr: getLatest('apple_health_resting_heart_rate'),
    sleep_avg: getLatest('apple_health_sleep_duration'),
    steps_avg: getLatest('apple_health_step_count'),
    hrv_avg: getLatest('apple_health_hrv')
  }

  // Filter out undefined values
  const filtered: Record<string, number> = {}
  for (const [k, v] of Object.entries(current)) {
    if (v !== undefined) filtered[k] = v
  }

  if (Object.keys(filtered).length === 0) return undefined

  return {
    current: filtered,
    baseline: filtered,  // Same at initialization
    trend: undefined  // No trend yet
  }
}

async function loadPhotoAnalysis(
  supabase: SupabaseClient,
  userId: string
): Promise<BodyPhotoData | undefined> {
  const { data: photos } = await supabase
    .from('eden_photo_uploads')
    .select('metadata_json, processed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!photos?.metadata_json) return undefined

  const metadata = photos.metadata_json as Record<string, unknown>

  return {
    current: {
      date: photos.processed_at,
      body_fat_estimate: metadata.body_fat_estimate as number | undefined,
      posture_notes: metadata.posture_notes as string | undefined,
      analysis_notes: metadata.overall_assessment as string | undefined
    }
  }
}

async function loadLabAnalysis(
  supabase: SupabaseClient,
  userId: string
): Promise<LabData | undefined> {
  const { data: labs } = await supabase
    .from('eden_lab_uploads')
    .select('extracted_values, analysis_metadata, lab_date, processed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!labs?.extracted_values) return undefined

  const markers = labs.extracted_values as Record<string, unknown>[] | undefined

  if (!markers?.length) return undefined

  // Build current lab data
  const current: LabData['current'] = {
    date: labs.lab_date || labs.processed_at || new Date().toISOString()
  }

  for (const marker of markers) {
    const name = (marker.name as string)?.toLowerCase().replace(/\s+/g, '_')
    if (name) {
      current[name] = {
        value: marker.value as number,
        unit: marker.unit as string,
        status: (marker.status as string) || 'normal'
      }
    }
  }

  return { current }
}

// ============================================================================
// Helpers
// ============================================================================

function extractStatedGoals(goalsJson: Record<string, unknown>): string[] {
  const goals: string[] = []
  
  if (goalsJson.focus_primary) {
    goals.push(goalsJson.focus_primary as string)
  }
  if (goalsJson.focus_secondary) {
    goals.push(goalsJson.focus_secondary as string)
  }
  if (goalsJson.specific_goals) {
    const specific = goalsJson.specific_goals
    if (Array.isArray(specific)) {
      goals.push(...specific)
    } else if (typeof specific === 'string') {
      goals.push(specific)
    }
  }
  
  return goals
}

/**
 * Extract stated facts from Prime Check answers
 * This pulls rich health context from the onboarding questionnaire
 */
function extractStatedFromPrimeCheck(primeCheck: Record<string, unknown>): StatedFact[] {
  const facts: StatedFact[] = []
  const now = new Date().toISOString()

  // Heart domain
  const heart = primeCheck.heart as Record<string, unknown> | undefined
  if (heart) {
    if (heart.cardio_frequency) {
      facts.push({ fact: `Cardio frequency: ${heart.cardio_frequency}`, date: now, source: 'prime_check' })
    }
    if (heart.resting_heart_rate) {
      facts.push({ fact: `Self-reported resting HR: ${heart.resting_heart_rate}`, date: now, source: 'prime_check' })
    }
    if (heart.heart_conditions && (heart.heart_conditions as string[]).length > 0) {
      facts.push({ fact: `Heart conditions: ${(heart.heart_conditions as string[]).join(', ')}`, date: now, source: 'prime_check' })
    }
  }

  // Frame domain (body/fitness)
  const frame = primeCheck.frame as Record<string, unknown> | undefined
  if (frame) {
    if (frame.strength_training_frequency) {
      facts.push({ fact: `Strength training: ${frame.strength_training_frequency}`, date: now, source: 'prime_check' })
    }
    if (frame.mobility_issues && (frame.mobility_issues as string[]).length > 0) {
      facts.push({ fact: `Mobility issues: ${(frame.mobility_issues as string[]).join(', ')}`, date: now, source: 'prime_check' })
    }
    if (frame.injuries && (frame.injuries as string[]).length > 0) {
      facts.push({ fact: `Current/past injuries: ${(frame.injuries as string[]).join(', ')}`, date: now, source: 'prime_check' })
    }
    if (frame.body_goal) {
      facts.push({ fact: `Body goal: ${frame.body_goal}`, date: now, source: 'prime_check' })
    }
  }

  // Metabolism domain
  const metabolism = primeCheck.metabolism as Record<string, unknown> | undefined
  if (metabolism) {
    if (metabolism.diet_type) {
      facts.push({ fact: `Diet type: ${metabolism.diet_type}`, date: now, source: 'prime_check' })
    }
    if (metabolism.energy_levels) {
      facts.push({ fact: `Energy levels: ${metabolism.energy_levels}`, date: now, source: 'prime_check' })
    }
    if (metabolism.digestion_issues && (metabolism.digestion_issues as string[]).length > 0) {
      facts.push({ fact: `Digestion issues: ${(metabolism.digestion_issues as string[]).join(', ')}`, date: now, source: 'prime_check' })
    }
    if (metabolism.metabolic_conditions && (metabolism.metabolic_conditions as string[]).length > 0) {
      facts.push({ fact: `Metabolic conditions: ${(metabolism.metabolic_conditions as string[]).join(', ')}`, date: now, source: 'prime_check' })
    }
  }

  // Recovery domain (sleep)
  const recovery = primeCheck.recovery as Record<string, unknown> | undefined
  if (recovery) {
    if (recovery.sleep_hours) {
      facts.push({ fact: `Typical sleep: ${recovery.sleep_hours} hours`, date: now, source: 'prime_check' })
    }
    if (recovery.sleep_quality) {
      facts.push({ fact: `Sleep quality: ${recovery.sleep_quality}`, date: now, source: 'prime_check' })
    }
    if (recovery.sleep_issues && (recovery.sleep_issues as string[]).length > 0) {
      facts.push({ fact: `Sleep issues: ${(recovery.sleep_issues as string[]).join(', ')}`, date: now, source: 'prime_check' })
    }
    if (recovery.stress_level) {
      facts.push({ fact: `Stress level: ${recovery.stress_level}`, date: now, source: 'prime_check' })
    }
  }

  // Mind domain
  const mind = primeCheck.mind as Record<string, unknown> | undefined
  if (mind) {
    if (mind.focus_rating) {
      facts.push({ fact: `Focus/concentration: ${mind.focus_rating}`, date: now, source: 'prime_check' })
    }
    if (mind.mood_rating) {
      facts.push({ fact: `Mood rating: ${mind.mood_rating}`, date: now, source: 'prime_check' })
    }
    if (mind.mental_health_conditions && (mind.mental_health_conditions as string[]).length > 0) {
      facts.push({ fact: `Mental health: ${(mind.mental_health_conditions as string[]).join(', ')}`, date: now, source: 'prime_check' })
    }
  }

  return facts
}

