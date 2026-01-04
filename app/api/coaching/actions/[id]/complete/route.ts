import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

// Mark action as complete
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this action (through protocol -> goal)
    const { data: action } = await supabase
      .from('eden_protocol_actions')
      .select(`
        id,
        eden_protocols!inner (
          goal_id,
          eden_goals!inner (
            user_id
          )
        )
      `)
      .eq('id', id)
      .single()

    if (!action || (action.eden_protocols as { eden_goals: { user_id: string } }).eden_goals.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Mark as complete
    const { error } = await supabase
      .from('eden_protocol_actions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Complete action error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Unmark action as complete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: action } = await supabase
      .from('eden_protocol_actions')
      .select(`
        id,
        eden_protocols!inner (
          goal_id,
          eden_goals!inner (
            user_id
          )
        )
      `)
      .eq('id', id)
      .single()

    if (!action || (action.eden_protocols as { eden_goals: { user_id: string } }).eden_goals.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Unmark completion
    const { error } = await supabase
      .from('eden_protocol_actions')
      .update({ completed_at: null })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Uncomplete action error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

