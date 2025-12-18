import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { loadScorecardInputs } from '@/lib/prime-scorecard/inputs'
import { computePrimeScorecard } from '@/lib/prime-scorecard/compute'

// Get scoring revision from environment
const SCORING_REVISION = process.env.VERCEL_GIT_COMMIT_SHA ?? 
                         process.env.GIT_COMMIT_SHA ?? 
                         'dev'

/**
 * DELETE /api/apple-health-imports/[import_id]/delete
 * 
 * Deletes an Apple Health import and all derived data:
 * - Deletes ZIP from Supabase Storage
 * - Deletes apple_health_imports row (metrics cascade-delete via FK)
 * - Deletes user's scorecards and clears latest_scorecard_id
 * - Generates a new scorecard from remaining metrics
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ import_id: string }> }
) {
  try {
    const supabase = await createServerClient()
    
    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { import_id: importId } = await params
    if (!importId) {
      return NextResponse.json({ error: 'import_id required' }, { status: 400 })
    }

    // 2. Load import row and verify ownership
    const { data: importRow, error: fetchError } = await supabase
      .from('apple_health_imports')
      .select('id, user_id, file_path, status')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !importRow) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    // 3. Delete ZIP from Supabase Storage (non-fatal if fails)
    if (importRow.file_path) {
      const { error: storageError } = await supabase.storage
        .from('apple_health_uploads')
        .remove([importRow.file_path])

      if (storageError) {
        console.warn('Failed to delete storage file (non-fatal):', storageError)
        // Continue with deletion - storage cleanup is best effort
      }
    }

    // 4. Delete all user's scorecards and clear latest_scorecard_id
    // Use service role client for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete all scorecards for this user
    const { error: deleteScorecardsError } = await adminSupabase
      .from('eden_user_scorecards')
      .delete()
      .eq('user_id', user.id)

    if (deleteScorecardsError) {
      console.error('Failed to delete scorecards:', deleteScorecardsError)
      // Continue - we'll try to clear latest_scorecard_id anyway
    }

    // Clear latest_scorecard_id
    const { error: clearStateError } = await adminSupabase
      .from('eden_user_state')
      .upsert({
        user_id: user.id,
        latest_scorecard_id: null,
      }, {
        onConflict: 'user_id',
      })

    if (clearStateError) {
      console.error('Failed to clear latest_scorecard_id:', clearStateError)
    }

    // 5. Delete the import row (this will cascade-delete metrics via FK)
    const { error: deleteImportError } = await adminSupabase
      .from('apple_health_imports')
      .delete()
      .eq('id', importId)

    if (deleteImportError) {
      console.error('Failed to delete import:', deleteImportError)
      return NextResponse.json({ 
        error: 'Failed to delete import',
        details: deleteImportError.message 
      }, { status: 500 })
    }

    // 6. Attempt to generate a fresh scorecard from remaining metrics
    let regenerated = false
    let newScorecardId: string | null = null

    try {
      const inputs = await loadScorecardInputs(adminSupabase, user.id)
      
      // Only generate if there are metrics remaining
      if (inputs.metrics.length > 0) {
        const nowIso = new Date().toISOString()
        const scorecard = computePrimeScorecard(inputs, nowIso, SCORING_REVISION)

        // Persist new scorecard
        const { data: insertedRow, error: insertError } = await adminSupabase
          .from('eden_user_scorecards')
          .insert({
            user_id: user.id,
            scorecard_json: scorecard,
            generated_at: scorecard.generated_at,
          })
          .select('id')
          .single()

        if (!insertError && insertedRow) {
          // Update latest_scorecard_id
          await adminSupabase
            .from('eden_user_state')
            .upsert({
              user_id: user.id,
              latest_scorecard_id: insertedRow.id,
            }, {
              onConflict: 'user_id',
            })

          regenerated = true
          newScorecardId = insertedRow.id
        } else {
          console.error('Failed to regenerate scorecard:', insertError)
        }
      }
    } catch (err) {
      console.error('Error regenerating scorecard (non-fatal):', err)
      // Don't fail the request - import was deleted successfully
    }

    return NextResponse.json({ 
      ok: true,
      regenerated,
      scorecard_id: newScorecardId || undefined,
    })

  } catch (err) {
    console.error('Delete import error:', err)
    return NextResponse.json({ 
      error: 'Internal error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}

