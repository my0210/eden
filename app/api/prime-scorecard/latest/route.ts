import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { PrimeScorecard } from '@/lib/prime-scorecard/types'

// Create Supabase client for this route handler
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

/**
 * GET /api/prime-scorecard/latest
 * 
 * Returns the user's latest Prime Scorecard.
 * 
 * Priority:
 * 1. If eden_user_state.latest_scorecard_id exists, fetch that specific row
 * 2. Otherwise, fetch the newest by generated_at for that user
 * 3. If none exists, return 404
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First, check if user has a latest_scorecard_id set
    const { data: userState } = await supabase
      .from('eden_user_state')
      .select('latest_scorecard_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let scorecard: PrimeScorecard | null = null
    let scorecardId: string | null = null

    if (userState?.latest_scorecard_id) {
      // Fetch the specific scorecard
      const { data: row } = await supabase
        .from('eden_user_scorecards')
        .select('id, scorecard_json, generated_at')
        .eq('id', userState.latest_scorecard_id)
        .maybeSingle()

      if (row) {
        scorecard = row.scorecard_json as PrimeScorecard
        scorecardId = row.id
      }
    }

    // Fallback: fetch newest by generated_at
    if (!scorecard) {
      const { data: row } = await supabase
        .from('eden_user_scorecards')
        .select('id, scorecard_json, generated_at')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (row) {
        scorecard = row.scorecard_json as PrimeScorecard
        scorecardId = row.id
      }
    }

    if (!scorecard) {
      return NextResponse.json({ error: 'No scorecard found' }, { status: 404 })
    }

    return NextResponse.json({ 
      scorecard, 
      scorecard_id: scorecardId 
    })

  } catch (err) {
    console.error('Prime Scorecard latest error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

