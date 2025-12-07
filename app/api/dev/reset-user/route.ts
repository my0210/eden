import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Create Supabase client for this route handler (same pattern as eden-coach/message)
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

    // 3) snapshots and metrics
    const { error: snapshotsDeleteError } = await supabase
      .from('eden_user_snapshots')
      .delete()
      .eq('user_id', userId)

    if (snapshotsDeleteError) {
      console.error('reset-user: eden_user_snapshots delete error', snapshotsDeleteError)
    }

    const { error: metricsDeleteError } = await supabase
      .from('eden_metric_values')
      .delete()
      .eq('user_id', userId)

    if (metricsDeleteError) {
      console.error('reset-user: eden_metric_values delete error', metricsDeleteError)
    }

    // 4) profile and persona
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

    // 5) Apple Health imports
    const { error: appleDeleteError } = await supabase
      .from('apple_health_imports')
      .delete()
      .eq('user_id', userId)

    if (appleDeleteError) {
      console.error('reset-user: apple_health_imports delete error', appleDeleteError)
    }

    console.log(`reset-user: successfully reset data for user ${userId}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('reset-user: unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
