import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface SaveOnboardingRequest {
  step: number
  onboarding_status?: 'in_progress' | 'profile_complete' | 'completed'
  patch: {
    goals_json?: Record<string, any>
    identity_json?: Record<string, any>
    safety_json?: Record<string, any>
    behaviors_json?: Record<string, any>
    coaching_json?: Record<string, any>
  }
}

/**
 * Deep merge two objects (one level deep)
 * If incoming value is null, it deletes the key
 */
function shallowMerge(
  existing: Record<string, any> | null,
  incoming: Record<string, any>
): Record<string, any> {
  const result = { ...(existing || {}) }
  
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null) {
      delete result[key]
    } else {
      result[key] = value
    }
  }
  
  return result
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body: SaveOnboardingRequest = await request.json()
    
    if (typeof body.step !== 'number' || body.step < 1 || body.step > 8) {
      return NextResponse.json({ error: 'Invalid step number' }, { status: 400 })
    }

    // Load current state
    const { data: currentState, error: fetchError } = await supabase
      .from('eden_user_state')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Build update object
    const update: Record<string, any> = {
      user_id: user.id,
      onboarding_step: Math.max(currentState?.onboarding_step || 0, body.step),
      updated_at: new Date().toISOString(),
    }

    // Update onboarding_status if provided
    if (body.onboarding_status) {
      update.onboarding_status = body.onboarding_status
    }

    // Merge JSON fields
    if (body.patch) {
      if (body.patch.goals_json !== undefined) {
        update.goals_json = shallowMerge(currentState?.goals_json, body.patch.goals_json)
      }
      if (body.patch.identity_json !== undefined) {
        update.identity_json = shallowMerge(currentState?.identity_json, body.patch.identity_json)
      }
      if (body.patch.safety_json !== undefined) {
        update.safety_json = shallowMerge(currentState?.safety_json, body.patch.safety_json)
      }
      if (body.patch.behaviors_json !== undefined) {
        update.behaviors_json = shallowMerge(currentState?.behaviors_json, body.patch.behaviors_json)
      }
      if (body.patch.coaching_json !== undefined) {
        update.coaching_json = shallowMerge(currentState?.coaching_json, body.patch.coaching_json)
      }
    }

    // Upsert the state
    const { data: updatedState, error: upsertError } = await supabase
      .from('eden_user_state')
      .upsert(update, { onConflict: 'user_id' })
      .select()
      .single()

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json(updatedState)
  } catch (error) {
    console.error('Error saving onboarding state:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

