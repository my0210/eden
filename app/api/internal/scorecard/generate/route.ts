import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { loadScorecardInputs } from '@/lib/prime-scorecard/inputs'
import { computePrimeScorecard } from '@/lib/prime-scorecard/compute'
import { PrimeScorecard } from '@/lib/prime-scorecard/types'

// Get scoring revision from environment
const SCORING_REVISION = process.env.VERCEL_GIT_COMMIT_SHA ?? 
                         process.env.GIT_COMMIT_SHA ?? 
                         'dev'

/**
 * POST /api/internal/scorecard/generate
 * 
 * Internal endpoint for Railway worker to trigger scorecard generation
 * after Apple Health processing completes.
 * 
 * Protected by WORKER_SECRET header.
 * 
 * Body: { user_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify WORKER_SECRET
    const authHeader = req.headers.get('authorization')
    const workerSecret = process.env.WORKER_SECRET
    
    if (!workerSecret) {
      console.error('WORKER_SECRET not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    
    if (!authHeader || authHeader !== `Bearer ${workerSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request body
    const body = await req.json().catch(() => ({}))
    const userId = body.user_id

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'user_id required in body' }, { status: 400 })
    }

    // 3. Create Supabase client with service role key (bypasses RLS)
    // Use service role key if available, otherwise use anon key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 4. Verify user exists
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !user) {
      // If admin API not available, just proceed (anon key with RLS will work)
      console.warn('Could not verify user via admin API, proceeding anyway')
    }

    const nowIso = new Date().toISOString()

    // 5. Load inputs
    const inputs = await loadScorecardInputs(supabase, userId)

    // 6. Compute scorecard
    const scorecard = computePrimeScorecard(inputs, nowIso, SCORING_REVISION)

    // 7. Persist to eden_user_scorecards
    const { data: insertedRow, error: insertError } = await supabase
      .from('eden_user_scorecards')
      .insert({
        user_id: userId,
        scorecard_json: scorecard,
        generated_at: scorecard.generated_at,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert scorecard:', insertError)
      return NextResponse.json({ 
        error: 'Failed to persist scorecard',
        details: insertError.message 
      }, { status: 500 })
    }

    // 8. Update eden_user_state.latest_scorecard_id
    const { error: updateError } = await supabase
      .from('eden_user_state')
      .upsert({
        user_id: userId,
        latest_scorecard_id: insertedRow.id,
      }, {
        onConflict: 'user_id',
      })

    if (updateError) {
      console.error('Failed to update latest_scorecard_id:', updateError)
      // Don't fail the request - scorecard was created successfully
    }

    return NextResponse.json({ 
      ok: true,
      scorecard_id: insertedRow.id,
      generated_at: scorecard.generated_at,
    })

  } catch (err) {
    console.error('Internal scorecard generation error:', err)
    return NextResponse.json({ 
      error: 'Internal error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}

