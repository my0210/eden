import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getDecisionsForGoal } from '@/lib/coaching/decisionLogging'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookies might be read-only
          }
        },
      },
    }
  )
}

// Get decisions for a goal
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const goalId = searchParams.get('goalId')

    if (!goalId) {
      return NextResponse.json({ error: 'goalId required' }, { status: 400 })
    }

    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this goal
    const { data: goal } = await supabase
      .from('eden_goals')
      .select('id')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .single()

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const decisions = await getDecisionsForGoal(supabase, goalId)

    return NextResponse.json({ decisions })
  } catch (error) {
    console.error('Get decisions error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

