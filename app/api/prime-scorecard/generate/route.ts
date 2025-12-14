import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { loadScorecardInputs } from '@/lib/prime-scorecard/inputs'
import { computePrimeScorecard } from '@/lib/prime-scorecard/compute'
import { PrimeScorecard } from '@/lib/prime-scorecard/types'

// Get scoring revision from environment
const SCORING_REVISION = process.env.VERCEL_GIT_COMMIT_SHA ?? 
                         process.env.GIT_COMMIT_SHA ?? 
                         'dev'

// Minimum time between scorecard generations (to prevent spam)
const MIN_GENERATION_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

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
 * Get the freshest evidence timestamp from a scorecard
 */
function getFreshestEvidenceTimestamp(scorecard: PrimeScorecard): string | null {
  let freshest: string | null = null
  for (const e of scorecard.evidence) {
    if (e.measured_at && (!freshest || e.measured_at > freshest)) {
      freshest = e.measured_at
    }
  }
  return freshest
}

/**
 * POST /api/prime-scorecard/generate
 * 
 * Generates a new Prime Scorecard from current evidence.
 * Persists the scorecard and updates latest_scorecard_id.
 * 
 * Idempotent guard: If the latest scorecard has the same scoring revision
 * and same evidence freshness and is < 10 minutes old, returns it instead.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const nowIso = new Date().toISOString()

    // Load inputs (read-only)
    const inputs = await loadScorecardInputs(supabase, user.id)

    // Check for recent scorecard with same evidence (idempotent guard)
    const { data: latestScorecard } = await supabase
      .from('eden_user_scorecards')
      .select('id, scorecard_json, generated_at')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestScorecard) {
      const existing = latestScorecard.scorecard_json as PrimeScorecard
      const generatedAt = new Date(latestScorecard.generated_at).getTime()
      const now = new Date(nowIso).getTime()
      const ageMs = now - generatedAt

      // Check if same scoring revision and recent enough
      if (
        existing.scoring_revision === SCORING_REVISION &&
        ageMs < MIN_GENERATION_INTERVAL_MS
      ) {
        // Check if evidence freshness is the same
        const existingFreshest = getFreshestEvidenceTimestamp(existing)
        const newInputsFreshest = inputs.metrics.length > 0 
          ? inputs.metrics[0].measured_at // Sorted by measured_at desc
          : null

        if (existingFreshest === newInputsFreshest) {
          // Return existing scorecard instead of creating new one
          return NextResponse.json({ 
            scorecard: existing, 
            scorecard_id: latestScorecard.id,
            cached: true 
          })
        }
      }
    }

    // Compute new scorecard
    const scorecard = computePrimeScorecard(inputs, nowIso, SCORING_REVISION)

    // Persist to eden_user_scorecards
    const { data: insertedRow, error: insertError } = await supabase
      .from('eden_user_scorecards')
      .insert({
        user_id: user.id,
        scorecard_json: scorecard,
        generated_at: scorecard.generated_at,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert scorecard:', insertError)
      // Still return the scorecard even if persistence fails
      return NextResponse.json({ scorecard, scorecard_id: null, persisted: false })
    }

    // Update eden_user_state.latest_scorecard_id
    const { error: updateError } = await supabase
      .from('eden_user_state')
      .update({ latest_scorecard_id: insertedRow.id })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update latest_scorecard_id:', updateError)
    }

    return NextResponse.json({ 
      scorecard, 
      scorecard_id: insertedRow.id,
      persisted: true 
    })

  } catch (err) {
    console.error('Prime Scorecard generate error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

