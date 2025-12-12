import { SupabaseClient } from '@supabase/supabase-js'

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed'

export interface EdenUserState {
  id: string
  user_id: string
  onboarding_status: OnboardingStatus
  onboarding_step: number
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
  return `/onboarding/${userState.onboarding_step}`
}

