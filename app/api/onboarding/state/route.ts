import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserState } from '@/lib/onboarding/getUserState'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current state (creates if doesn't exist)
    const state = await getUserState(supabase, user.id)

    return NextResponse.json(state)
  } catch (error) {
    console.error('Error fetching onboarding state:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

