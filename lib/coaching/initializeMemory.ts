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
  NotableEvent
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

  // 1. Load user state (onboarding data)
  const { data: userState } = await supabase
    .from('eden_user_state')
    .select('identity_json, goals_json')
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

  const confirmed: ConfirmedData = {
    prime_check: primeCheck,
    apple_health: appleHealthData,
    body_photos: photoData,
    labs: labData,
    protocol: undefined  // No goal yet
  }

  // Build stated facts from onboarding
  const stated: StatedFact[] = []
  
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
    .from('eden_user_photos')
    .select('analysis_json, uploaded_at')
    .eq('user_id', userId)
    .not('analysis_json', 'is', null)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!photos?.analysis_json) return undefined

  const analysis = photos.analysis_json as Record<string, unknown>

  return {
    current: {
      date: photos.uploaded_at,
      body_fat_estimate: analysis.body_fat_estimate as number | undefined,
      posture_notes: analysis.posture_notes as string | undefined,
      analysis_notes: analysis.notes as string | undefined
    }
  }
}

async function loadLabAnalysis(
  supabase: SupabaseClient,
  userId: string
): Promise<LabData | undefined> {
  const { data: labs } = await supabase
    .from('eden_lab_reports')
    .select('analysis_json, uploaded_at')
    .eq('user_id', userId)
    .not('analysis_json', 'is', null)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!labs?.analysis_json) return undefined

  const analysis = labs.analysis_json as Record<string, unknown>
  const markers = analysis.markers as Record<string, unknown>[] | undefined

  if (!markers?.length) return undefined

  // Build current lab data
  const current: Record<string, unknown> = {
    date: labs.uploaded_at
  }

  for (const marker of markers) {
    const name = (marker.name as string)?.toLowerCase().replace(/\s+/g, '_')
    if (name) {
      current[name] = {
        value: marker.value,
        unit: marker.unit,
        status: marker.status || 'normal'
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

