import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Auth client
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

// Admin client
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

/**
 * Reset coaching data only - keeps onboarding, profile, scorecard, uploads intact.
 * Clears: conversations, messages, goals, protocols, milestones, actions, checkins, decisions
 */
export async function POST() {
  const authSupabase = await getAuthSupabase()

  const { data: { user }, error: authError } = await authSupabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  try {
    const supabase = getAdminSupabase()
    console.log('reset-coaching: clearing coaching data for user', userId)

    const results: Record<string, { deleted?: number; error?: string }> = {}

    // 1) Delete conversations + messages
    const { data: conversations } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', userId)

    const conversationIds = (conversations ?? []).map(c => c.id)

    if (conversationIds.length > 0) {
      const { error: msgError } = await supabase
        .from('eden_messages')
        .delete()
        .in('conversation_id', conversationIds)

      results['eden_messages'] = msgError 
        ? { error: msgError.message } 
        : { deleted: conversationIds.length }
    }

    const { error: convError } = await supabase
      .from('eden_conversations')
      .delete()
      .eq('user_id', userId)

    results['eden_conversations'] = convError 
      ? { error: convError.message } 
      : { deleted: conversationIds.length }

    // 2) Delete goals (cascades to protocols, milestones, actions, checkins, decisions)
    const { data: goals } = await supabase
      .from('eden_goals')
      .select('id')
      .eq('user_id', userId)

    const goalCount = goals?.length ?? 0

    const { error: goalsError } = await supabase
      .from('eden_goals')
      .delete()
      .eq('user_id', userId)

    results['eden_goals'] = goalsError 
      ? { error: goalsError.message } 
      : { deleted: goalCount }

    // 3) Clear user memory
    const { error: memoryError } = await supabase
      .from('eden_user_memory')
      .delete()
      .eq('user_id', userId)

    results['eden_user_memory'] = memoryError 
      ? { error: memoryError.message } 
      : { deleted: 1 }

    console.log(`reset-coaching: cleared coaching data for user ${userId}`)

    return NextResponse.json({ 
      ok: true, 
      userId,
      results,
      message: 'Coaching data cleared. Onboarding and uploads preserved.' 
    })
  } catch (err) {
    console.error('reset-coaching: unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

