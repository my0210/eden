import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/user/identity
 * 
 * Returns the user's identity information (age, weight, height, etc.)
 * from eden_user_state.identity_json
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
      .select('identity_json')
      .eq('user_id', user.id)
      .maybeSingle()

    if (stateError) {
      console.error('Error fetching user state:', stateError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    if (!userState?.identity_json) {
      return NextResponse.json({})
    }

    const identity = userState.identity_json as {
      age?: number
      dob?: string
      sex_at_birth?: string
      height?: number
      weight?: number
      units?: string
    }

    return NextResponse.json({
      age: identity.age,
      dob: identity.dob,
      sex_at_birth: identity.sex_at_birth,
      height: identity.height,
      weight: identity.weight,
      units: identity.units,
    })
  } catch (error) {
    console.error('Error in /api/user/identity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

