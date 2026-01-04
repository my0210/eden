import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateProtocolForGoal } from '@/lib/coaching/generateProtocol'
import { Goal } from '@/lib/coaching/types'

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

// Generate a new protocol for a goal
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { goalId } = body

    if (!goalId) {
      return NextResponse.json({ error: 'goalId required' }, { status: 400 })
    }

    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the goal
    const { data: goal, error: goalError } = await supabase
      .from('eden_goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // Generate protocol
    const result = await generateProtocolForGoal(
      supabase,
      user.id,
      goal as Goal
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      protocol: result.protocol,
      milestones: result.milestones,
      actions: result.actions,
    })
  } catch (error) {
    console.error('Protocol generation error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

