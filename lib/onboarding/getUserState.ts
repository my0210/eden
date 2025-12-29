import { SupabaseClient } from '@supabase/supabase-js'
import { PrimeCheckJson } from './types'

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed'

/**
 * Goals JSON structure (v2)
 * - focus_primary: optional primary focus area
 * - focus_secondary: optional secondary focus area
 * - uploads_skipped: true if user skipped the uploads step
 */
export interface GoalsJson {
  focus_primary?: string | null
  focus_secondary?: string | null
  uploads_skipped?: boolean
}

/**
 * Safety JSON structure (v2)
 * - privacy_ack: required acknowledgment of privacy policy
 * - diagnoses: "none" or list of diagnosed conditions
 * - meds: "none" or list of medications
 * - injuries_limitations: "none" or description
 * - red_lines: "none" or things user won't do
 * - doctor_restrictions: "none" or restrictions
 */
export interface SafetyJson {
  privacy_ack?: boolean
  diagnoses?: string | string[]
  meds?: string | string[]
  injuries_limitations?: string
  red_lines?: string
  doctor_restrictions?: string
}

/**
 * Identity JSON structure (v2)
 * - dob: date of birth (optional if age provided)
 * - age: age in years (optional if dob provided)
 * - sex_at_birth: "male" | "female"
 * - height: number (in cm or inches based on units)
 * - weight: number (in kg or lbs based on units)
 * - units: "metric" | "imperial"
 * - data_sources: optional metadata about imported data
 */
export interface IdentityJson {
  dob?: string | null
  age?: number | null
  sex_at_birth?: 'male' | 'female' | null
  height?: number | null
  weight?: number | null
  units?: 'metric' | 'imperial' | null
  data_sources?: {
    appleHealthImportId?: string
  }
}

/**
 * Eden User State - stored in eden_user_state table
 */
export interface EdenUserState {
  user_id: string
  onboarding_status: OnboardingStatus
  onboarding_step: number
  goals_json?: GoalsJson | null
  identity_json?: IdentityJson | null
  safety_json?: SafetyJson | null
  /** Prime Check answers from onboarding v3 (Step 5) */
  prime_check_json?: PrimeCheckJson | null
  // Legacy fields (kept for backwards compatibility but not used in v2)
  behaviors_json?: Record<string, unknown> | null
  coaching_json?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * Gets or creates the eden_user_state record for the authenticated user.
 * Returns the user state, creating a new one with default values if none exists.
 */
export async function getUserState(
  supabase: SupabaseClient,
  userId: string
): Promise<EdenUserState> {
  // Try to get existing state
  const { data: existingState, error: fetchError } = await supabase
    .from('eden_user_state')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Return existing state if found
  if (existingState && !fetchError) {
    return existingState as EdenUserState
  }

  // If not found (PGRST116 = no rows), create new state
  if (!fetchError || fetchError.code === 'PGRST116') {
    const { data: newState, error: insertError } = await supabase
      .from('eden_user_state')
      .insert({
        user_id: userId,
        onboarding_status: 'not_started' as OnboardingStatus,
        onboarding_step: 1,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create user state: ${insertError.message}`)
    }

    return newState as EdenUserState
  }

  // Some other database error occurred
  throw new Error(`Failed to fetch user state: ${fetchError.message}`)
}

/**
 * Check if user has completed onboarding
 */
export async function isOnboardingComplete(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const state = await getUserState(supabase, userId)
  return state.onboarding_status === 'completed'
}

/**
 * Get the redirect path based on user's onboarding status
 */
export function getRedirectPath(userState: EdenUserState): string {
  if (userState.onboarding_status === 'completed') {
    return '/chat'
  }
  // Start at step 1 if not started, otherwise continue where they left off
  const step = userState.onboarding_step || 1
  return `/onboarding/${Math.max(1, step)}`
}
