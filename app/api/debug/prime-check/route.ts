import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/debug/prime-check
 * 
 * Debug endpoint to see what's in prime_check_json
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userState, error: stateError } = await supabase
      .from('eden_user_state')
      .select('prime_check_json, identity_json')
      .eq('user_id', user.id)
      .maybeSingle()

    if (stateError) {
      return NextResponse.json({ error: stateError.message }, { status: 500 })
    }

    const primeCheck = userState?.prime_check_json as Record<string, unknown> | null
    const identity = userState?.identity_json as Record<string, unknown> | null

    return NextResponse.json({
      has_prime_check: !!primeCheck,
      schema_version: primeCheck?.schema_version,
      has_frame: !!primeCheck?.frame,
      frame_keys: primeCheck?.frame ? Object.keys(primeCheck.frame as object) : [],
      photo_analysis: (primeCheck?.frame as { photo_analysis?: unknown })?.photo_analysis || null,
      identity_weight: identity?.weight,
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

