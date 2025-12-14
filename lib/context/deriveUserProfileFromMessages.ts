import { SupabaseClient } from '@supabase/supabase-js'

/**
 * DISABLED in v2: Message-derived profile extraction
 * 
 * In v2, onboarding essentials (eden_user_state.identity_json) are the single source of truth.
 * This function is kept for potential future re-introduction where it could extract
 * supplementary info (e.g., first_name, additional goals) WITHOUT overwriting essentials.
 * 
 * TODO: If re-enabling, ensure:
 * - Do NOT overwrite age, sex_at_birth, height, weight from eden_user_state.identity_json
 * - Do NOT overwrite safety rails from eden_user_state.safety_json
 * - Only extract supplementary fields like first_name or conversation-derived preferences
 */
export async function deriveUserProfileFromMessages(
  _supabase: SupabaseClient,
  _userId: string
): Promise<void> {
  // DISABLED: Onboarding essentials are now the source of truth
  // See eden_user_state.identity_json and safety_json
  // 
  // The original implementation used OpenAI to extract profile fields from chat messages.
  // This is now disabled to prevent overwriting user-provided onboarding data.
  return
}
