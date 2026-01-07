import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateMemory, updateConfirmed, DomainSelectionData } from '@/lib/coaching/memory'

/**
 * GET /api/user/focus-areas
 * 
 * Returns the user's selected focus areas from memory
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get from memory
    const memory = await getOrCreateMemory(supabase, user.id)
    
    return NextResponse.json({
      domain_selection: memory.confirmed.domain_selection || null,
    })
  } catch (err) {
    console.error('Failed to get focus areas:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/user/focus-areas
 * 
 * Updates the user's focus areas in both user_state and memory
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { primary, secondary, time_budget_hours } = body

    if (!primary) {
      return NextResponse.json({ error: 'Primary focus is required' }, { status: 400 })
    }

    const domainSelection: DomainSelectionData = {
      primary,
      secondary: secondary || null,
      time_budget_hours: time_budget_hours || 5,
      selected_at: new Date().toISOString(),
    }

    // Update user_state.coaching_json
    const { data: currentState } = await supabase
      .from('eden_user_state')
      .select('coaching_json')
      .eq('user_id', user.id)
      .maybeSingle()

    const existingCoaching = currentState?.coaching_json || {}
    
    await supabase
      .from('eden_user_state')
      .upsert({
        user_id: user.id,
        coaching_json: {
          ...existingCoaching,
          domain_selection: domainSelection,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    // Update memory
    await updateConfirmed(supabase, user.id, 'domain_selection', domainSelection)

    return NextResponse.json({
      domain_selection: domainSelection,
    })
  } catch (err) {
    console.error('Failed to update focus areas:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

