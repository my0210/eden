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

    // Also get latest photo upload to see what was stored there
    const { data: latestPhoto } = await supabase
      .from('eden_photo_uploads')
      .select('id, metadata_json, created_at')
      .eq('user_id', user.id)
      .eq('kind', 'body_photo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const primeCheck = userState?.prime_check_json as Record<string, unknown> | null
    const identity = userState?.identity_json as Record<string, unknown> | null
    const photoMetadata = latestPhoto?.metadata_json as Record<string, unknown> | null

    return NextResponse.json({
      // Identity info
      identity_weight: identity?.weight,
      identity_height: identity?.height,
      
      // Prime check info
      has_prime_check: !!primeCheck,
      schema_version: primeCheck?.schema_version,
      has_frame: !!primeCheck?.frame,
      frame_keys: primeCheck?.frame ? Object.keys(primeCheck.frame as object) : [],
      
      // Photo analysis from prime_check_json
      photo_analysis: (primeCheck?.frame as { photo_analysis?: unknown })?.photo_analysis || null,
      
      // Latest photo upload metadata (for comparison)
      latest_photo: latestPhoto ? {
        id: latestPhoto.id,
        created_at: latestPhoto.created_at,
        has_analysis: !!photoMetadata?.analysis,
        has_derived: !!photoMetadata?.derived,
        body_fat_estimate: (photoMetadata?.analysis as { body_fat_estimate?: unknown })?.body_fat_estimate,
        lean_mass_from_metadata: (photoMetadata?.derived as { lean_mass_estimate_kg?: unknown })?.lean_mass_estimate_kg,
        weight_used: photoMetadata?.weight_kg,
      } : null,
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

