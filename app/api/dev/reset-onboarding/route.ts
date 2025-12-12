import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_EMAILS = process.env.ALLOWED_DEV_EMAILS?.split(',').map(e => e.trim()) || []

function isDevAllowed(email: string | undefined): boolean {
  // Check env var first
  if (process.env.ALLOW_DEV_TOOLS === 'true') {
    return true
  }
  
  // Check email allow-list
  if (email && ALLOWED_EMAILS.length > 0) {
    return ALLOWED_EMAILS.includes(email)
  }
  
  return false
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check dev access
    if (!isDevAllowed(user.email)) {
      return NextResponse.json({ error: 'Forbidden: Dev tools not enabled' }, { status: 403 })
    }

    // Reset onboarding state
    const { error: updateError } = await supabase
      .from('eden_user_state')
      .update({
        onboarding_status: 'not_started',
        onboarding_step: 0,
        goals_json: {},
        identity_json: {},
        safety_json: {},
        behaviors_json: {},
        coaching_json: {},
        latest_snapshot_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error resetting onboarding:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset onboarding state' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in reset-onboarding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

