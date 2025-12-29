/**
 * Scorecard Inputs Loader
 * 
 * Fetches all data needed to compute a Prime Scorecard.
 * This is READ-ONLY - no database writes occur.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EvidenceSource } from './types'
import type { PrimeCheckJson } from '@/lib/onboarding/types'

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single metric value from the database
 */
export type MetricInput = {
  metric_code: string
  value_raw: number | string | boolean
  unit?: string
  measured_at: string
  source: EvidenceSource
  import_id?: string // Apple Health import ID (for provenance)
}

/**
 * Apple Health import status
 */
export type AppleHealthUploadStatus = {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  uploaded_at?: string
  processed_at?: string
  failed_at?: string
  error_message?: string
}

/**
 * Photo uploads summary
 */
export type PhotoUploadsSummary = {
  count: number
  latest_uploaded_at?: string
}

/**
 * Self-reported essentials from onboarding
 */
export type SelfReportEssentials = {
  dob?: string
  age?: number
  sex_at_birth?: string
  height?: number
  weight?: number
  units?: string
}

// PrimeCheckJson is imported from @/lib/onboarding/types
// Re-export for backwards compatibility
export type { PrimeCheckJson }

/**
 * All inputs needed to compute a scorecard
 */
export type ScorecardInputs = {
  /** Metric values from eden_metric_values */
  metrics: MetricInput[]
  /** Upload status information */
  uploads: {
    apple_health?: AppleHealthUploadStatus
    photos: PhotoUploadsSummary
  }
  /** Self-reported essentials from onboarding */
  self_report: SelfReportEssentials
  /** Prime Check data from onboarding v3 */
  prime_check?: PrimeCheckJson
  /** When inputs were loaded */
  loaded_at: string
}

// =============================================================================
// LOADER FUNCTION
// =============================================================================

/**
 * Load all inputs needed to compute a Prime Scorecard.
 * 
 * This function:
 * - Reads latest metric values per metric_code
 * - Reads Apple Health import status
 * - Reads photo upload count and latest timestamp
 * - Reads self-reported essentials from eden_user_state
 * 
 * It NEVER throws on missing data - returns empty/default values instead.
 * It NEVER writes to the database.
 * 
 * @param supabase - Supabase client
 * @param userId - User ID to load inputs for
 * @returns ScorecardInputs object (always valid, may have empty fields)
 */
export async function loadScorecardInputs(
  supabase: SupabaseClient,
  userId: string
): Promise<ScorecardInputs> {
  const loaded_at = new Date().toISOString()

  // Initialize with defaults
  const inputs: ScorecardInputs = {
    metrics: [],
    uploads: {
      apple_health: undefined,
      photos: { count: 0 },
    },
    self_report: {},
    prime_check: undefined,
    loaded_at,
  }

  // 1. Load metric values (deduped to latest per metric_code)
  try {
    const { data: metricRows } = await supabase
      .from('eden_metric_values')
      .select(`
        id,
        metric_id,
        value,
        measured_at,
        import_id,
        eden_metric_definitions (
          metric_code,
          unit
        )
      `)
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })

    if (metricRows && metricRows.length > 0) {
      // Dedupe to latest per metric_code
      const latestByCode = new Map<string, MetricInput>()

      for (const row of metricRows) {
        const def = row.eden_metric_definitions as unknown as {
          metric_code: string
          unit: string | null
        } | null

        if (!def?.metric_code) continue

        // Skip if we already have this metric (first is latest due to order)
        if (latestByCode.has(def.metric_code)) continue

        latestByCode.set(def.metric_code, {
          metric_code: def.metric_code,
          value_raw: row.value,
          unit: def.unit || undefined,
          measured_at: row.measured_at,
          source: 'apple_health', // Currently all metrics come from Apple Health
          import_id: (row as { import_id?: string }).import_id,
        })
      }

      // === Combine bp_systolic + bp_diastolic into blood_pressure ===
      const bpSystolic = latestByCode.get('bp_systolic')
      const bpDiastolic = latestByCode.get('bp_diastolic')
      
      if (bpSystolic && bpDiastolic) {
        // Use the newer timestamp of the two
        const newerTimestamp = bpSystolic.measured_at > bpDiastolic.measured_at 
          ? bpSystolic.measured_at 
          : bpDiastolic.measured_at
        
        // Create combined blood_pressure metric for scoring
        latestByCode.set('blood_pressure', {
          metric_code: 'blood_pressure',
          value_raw: `${bpSystolic.value_raw}/${bpDiastolic.value_raw}`,
          unit: 'mmHg',
          measured_at: newerTimestamp,
          source: 'apple_health',
        })
      }

      inputs.metrics = Array.from(latestByCode.values())
    }
  } catch (e) {
    console.error('loadScorecardInputs: Failed to load metrics', e)
  }

  // 2. Load Apple Health import status (latest)
  try {
    const { data: ahImport } = await supabase
      .from('apple_health_imports')
      .select('status, uploaded_at, processed_at, failed_at, error_message')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ahImport) {
      inputs.uploads.apple_health = {
        status: ahImport.status as AppleHealthUploadStatus['status'],
        uploaded_at: ahImport.uploaded_at || undefined,
        processed_at: ahImport.processed_at || undefined,
        failed_at: ahImport.failed_at || undefined,
        error_message: ahImport.error_message || undefined,
      }
    }
  } catch (e) {
    console.error('loadScorecardInputs: Failed to load Apple Health status', e)
  }

  // 3. Load photo uploads count and latest timestamp
  try {
    const { data: photos, count } = await supabase
      .from('photo_uploads')
      .select('uploaded_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    inputs.uploads.photos = {
      count: count || 0,
      latest_uploaded_at: photos?.[0]?.uploaded_at || undefined,
    }
  } catch (e) {
    // Table might not exist or query failed
    console.error('loadScorecardInputs: Failed to load photos', e)
  }

  // 4. Load self-reported essentials and prime_check from eden_user_state
  try {
    const { data: userState } = await supabase
      .from('eden_user_state')
      .select('identity_json, prime_check_json')
      .eq('user_id', userId)
      .maybeSingle()

    if (userState?.identity_json) {
      const identity = userState.identity_json as Record<string, unknown>
      inputs.self_report = {
        dob: identity.dob as string | undefined,
        age: identity.age as number | undefined,
        sex_at_birth: identity.sex_at_birth as string | undefined,
        height: identity.height as number | undefined,
        weight: identity.weight as number | undefined,
        units: identity.units as string | undefined,
      }
    }

    // Load prime_check_json if present (onboarding v3)
    if (userState?.prime_check_json) {
      inputs.prime_check = userState.prime_check_json as PrimeCheckJson
    }
  } catch (e) {
    console.error('loadScorecardInputs: Failed to load self-report essentials', e)
  }

  return inputs
}

/**
 * Check if inputs have any scorable metrics
 */
export function hasScorableMetrics(inputs: ScorecardInputs): boolean {
  return inputs.metrics.length > 0
}

/**
 * Get the most recent measured_at timestamp from inputs
 */
export function getMostRecentMeasurement(inputs: ScorecardInputs): string | null {
  if (inputs.metrics.length === 0) return null
  
  // Already sorted by measured_at desc in loader
  return inputs.metrics[0].measured_at
}

