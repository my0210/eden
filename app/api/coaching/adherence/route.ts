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

function getWeekStart(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekEnd(): Date {
  const d = getWeekStart()
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const protocolId = searchParams.get('protocolId')

    if (!protocolId) {
      return NextResponse.json({ error: 'protocolId required' }, { status: 400 })
    }

    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const weekStart = getWeekStart()
    const weekEnd = getWeekEnd()

    // Count completed actions this week
    const { count: actionsCompleted } = await supabase
      .from('eden_protocol_actions')
      .select('id', { count: 'exact', head: true })
      .eq('protocol_id', protocolId)
      .not('completed_at', 'is', null)
      .gte('completed_at', weekStart.toISOString())
      .lte('completed_at', weekEnd.toISOString())

    // Count total actions
    const { count: actionsTotal } = await supabase
      .from('eden_protocol_actions')
      .select('id', { count: 'exact', head: true })
      .eq('protocol_id', protocolId)

    return NextResponse.json({
      actionsCompleted: actionsCompleted ?? 0,
      actionsTotal: actionsTotal ?? 0,
    })
  } catch (error) {
    console.error('Adherence error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
