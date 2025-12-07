import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Create Supabase client for this route handler (same pattern as other routes)
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

export async function POST() {
  const supabase = await getSupabase()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  try {
    // 1) Load this user's plan ids (for foreign key constraint)
    const { data: plans, error: plansError } = await supabase
      .from('eden_plans')
      .select('id')
      .eq('user_id', userId)

    if (plansError) {
      console.error('reset-user: eden_plans select error', plansError)
    }

    const planIds = (plans ?? []).map((p) => p.id)

    // 2) Delete plan actions first (foreign key to eden_plans)
    if (planIds.length > 0) {
      const { error: actionsError } = await supabase
        .from('eden_plan_actions')
        .delete()
        .in('plan_id', planIds)

      if (actionsError) {
        console.error('reset-user: eden_plan_actions delete error', actionsError)
      }
    }

    // 3) Delete plans
    const { error: plansDeleteError } = await supabase
      .from('eden_plans')
      .delete()
      .eq('user_id', userId)

    if (plansDeleteError) {
      console.error('reset-user: eden_plans delete error', plansDeleteError)
    }

    // 4) Load conversation ids for messages
    const { data: conversations, error: convSelectError } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', userId)

    if (convSelectError) {
      console.error('reset-user: eden_conversations select error', convSelectError)
    }

    const conversationIds = (conversations ?? []).map((c) => c.id)

    // 5) Delete messages (uses conversation_id, not user_id)
    if (conversationIds.length > 0) {
      const { error: msgError } = await supabase
        .from('eden_messages')
        .delete()
        .in('conversation_id', conversationIds)

      if (msgError) {
        console.error('reset-user: eden_messages delete error', msgError)
      }
    }

    // 6) Delete conversations
    const { error: convError } = await supabase
      .from('eden_conversations')
      .delete()
      .eq('user_id', userId)

    if (convError) {
      console.error('reset-user: eden_conversations delete error', convError)
    }

    // 7) Delete snapshots
    const { error: snapshotError } = await supabase
      .from('eden_user_snapshots')
      .delete()
      .eq('user_id', userId)

    if (snapshotError) {
      console.error('reset-user: eden_user_snapshots delete error', snapshotError)
    }

    // 8) Delete metric values
    const { error: metricError } = await supabase
      .from('eden_metric_values')
      .delete()
      .eq('user_id', userId)

    if (metricError) {
      console.error('reset-user: eden_metric_values delete error', metricError)
    }

    // 9) Delete profile
    const { error: profileError } = await supabase
      .from('eden_user_profile')
      .delete()
      .eq('user_id', userId)

    if (profileError) {
      console.error('reset-user: eden_user_profile delete error', profileError)
    }

    // 10) Delete persona
    const { error: personaError } = await supabase
      .from('eden_user_personas')
      .delete()
      .eq('user_id', userId)

    if (personaError) {
      console.error('reset-user: eden_user_personas delete error', personaError)
    }

    // 11) Delete Apple Health imports
    const { error: appleError } = await supabase
      .from('apple_health_imports')
      .delete()
      .eq('user_id', userId)

    if (appleError) {
      console.error('reset-user: apple_health_imports delete error', appleError)
    }

    console.log(`reset-user: successfully reset data for user ${userId}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('reset-user: unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

