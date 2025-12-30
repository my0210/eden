import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Create Supabase client for auth only
async function getAuthSupabase() {
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

// Create admin client with service role key for data operations
function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST() {
  const authSupabase = await getAuthSupabase()

  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  try {
    // Use service role client for all data operations (bypasses RLS)
    const supabase = getAdminSupabase()
    console.log('reset-user: using service role client for user', userId)
    
    // 1) conversations + messages
    const { data: conversations, error: convSelectError } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', userId)

    if (convSelectError) {
      console.error('reset-user: eden_conversations select error', convSelectError)
    }

    const conversationIds = (conversations ?? []).map((c) => c.id)

    if (conversationIds.length > 0) {
      const { error: msgDeleteError } = await supabase
        .from('eden_messages')
        .delete()
        .in('conversation_id', conversationIds)

      if (msgDeleteError) {
        console.error('reset-user: eden_messages delete error', msgDeleteError)
      }
    }

    const { error: convDeleteError } = await supabase
      .from('eden_conversations')
      .delete()
      .eq('user_id', userId)

    if (convDeleteError) {
      console.error('reset-user: eden_conversations delete error', convDeleteError)
    }

    // 2) plans + actions
    const { data: plans, error: plansSelectError } = await supabase
      .from('eden_plans')
      .select('id')
      .eq('user_id', userId)

    if (plansSelectError) {
      console.error('reset-user: eden_plans select error', plansSelectError)
    }

    const planIds = (plans ?? []).map((p) => p.id)

    if (planIds.length > 0) {
      const { error: actionsDeleteError } = await supabase
        .from('eden_plan_actions')
        .delete()
        .in('plan_id', planIds)

      if (actionsDeleteError) {
        console.error('reset-user: eden_plan_actions delete error', actionsDeleteError)
      }
    }

    const { error: plansDeleteError } = await supabase
      .from('eden_plans')
      .delete()
      .eq('user_id', userId)

    if (plansDeleteError) {
      console.error('reset-user: eden_plans delete error', plansDeleteError)
    }

    // 3) scorecards - MUST clear latest_scorecard_id FIRST (FK constraint)
    const { error: clearScorecardRefError } = await supabase
      .from('eden_user_state')
      .update({ latest_scorecard_id: null })
      .eq('user_id', userId)

    if (clearScorecardRefError) {
      console.error('reset-user: clear latest_scorecard_id error', clearScorecardRefError)
    }

    // Now safe to delete scorecards
    const { error: scorecardsDeleteError } = await supabase
      .from('eden_user_scorecards')
      .delete()
      .eq('user_id', userId)

    if (scorecardsDeleteError) {
      console.error('reset-user: eden_user_scorecards delete error', scorecardsDeleteError)
    }

    // Keep legacy snapshot deletion for cleanup (table still exists, just unused)
    const { error: snapshotsDeleteError } = await supabase
      .from('eden_user_snapshots')
      .delete()
      .eq('user_id', userId)

    if (snapshotsDeleteError) {
      console.error('reset-user: eden_user_snapshots delete error', snapshotsDeleteError)
    }

    // 4) metrics
    const { error: metricsDeleteError } = await supabase
      .from('eden_metric_values')
      .delete()
      .eq('user_id', userId)

    if (metricsDeleteError) {
      console.error('reset-user: eden_metric_values delete error', metricsDeleteError)
    }

    // 5) profile and persona
    const { error: profileDeleteError } = await supabase
      .from('eden_user_profile')
      .delete()
      .eq('user_id', userId)

    if (profileDeleteError) {
      console.error('reset-user: eden_user_profile delete error', profileDeleteError)
    }

    const { error: personaDeleteError } = await supabase
      .from('eden_user_personas')
      .delete()
      .eq('user_id', userId)

    if (personaDeleteError) {
      console.error('reset-user: eden_user_personas delete error', personaDeleteError)
    }

    // 6) Apple Health imports - delete from storage first, then DB
    try {
      // Get list of import records to find storage paths
      const { data: imports } = await supabase
        .from('apple_health_imports')
        .select('id, file_path')
        .eq('user_id', userId)

      if (imports && imports.length > 0) {
        // Delete files from storage
        const storagePaths = imports
          .map(i => i.file_path)
          .filter(Boolean) as string[]
        
        if (storagePaths.length > 0) {
          const { error: storageDeleteError } = await supabase.storage
            .from('apple_health_uploads')
            .remove(storagePaths)
          
          if (storageDeleteError) {
            console.error('reset-user: apple_health storage delete error', storageDeleteError)
          }
        }
      }
    } catch (ahStorageErr) {
      console.error('reset-user: apple_health storage cleanup error', ahStorageErr)
    }

    // Delete Apple Health import records
    const { error: appleDeleteError } = await supabase
      .from('apple_health_imports')
      .delete()
      .eq('user_id', userId)

    if (appleDeleteError) {
      console.error('reset-user: apple_health_imports delete error', appleDeleteError)
    }

    // 6b) Body photos - delete from storage first, then DB
    try {
      // Get list of photo records to find storage paths
      const { data: photos } = await supabase
        .from('eden_photo_uploads')
        .select('id, file_path')
        .eq('user_id', userId)

      if (photos && photos.length > 0) {
        // Delete files from storage
        const storagePaths = photos
          .map(p => p.file_path)
          .filter(Boolean) as string[]
        
        if (storagePaths.length > 0) {
          const { error: storageDeleteError } = await supabase.storage
            .from('body_photos')
            .remove(storagePaths)
          
          if (storageDeleteError) {
            console.error('reset-user: storage delete error', storageDeleteError)
          }
        }

        // Delete DB records
        const { error: photosDeleteError } = await supabase
          .from('eden_photo_uploads')
          .delete()
          .eq('user_id', userId)

        if (photosDeleteError) {
          console.error('reset-user: eden_photo_uploads delete error', photosDeleteError)
        }
      }
    } catch (photoErr) {
      console.error('reset-user: photo cleanup error', photoErr)
    }

    // 7) Reset eden_user_state (v2/v3 onboarding)
    const { error: stateResetError } = await supabase
      .from('eden_user_state')
      .update({
        onboarding_status: 'not_started',
        onboarding_step: 0,
        goals_json: {},
        identity_json: {},
        safety_json: {},
        prime_check_json: {},  // v3: all domain self-assessments, photo analysis, focus check
        behaviors_json: {},
        coaching_json: {},
        latest_scorecard_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (stateResetError) {
      console.error('reset-user: eden_user_state reset error', stateResetError)
    }

    console.log(`reset-user: successfully reset data for user ${userId}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('reset-user: unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
