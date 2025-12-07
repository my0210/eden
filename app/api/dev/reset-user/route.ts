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
  const results: Record<string, { deleted?: number; error?: string }> = {}

  try {
    // 1) Load this user's plan ids (for foreign key constraint)
    const { data: plans, error: plansError } = await supabase
      .from('eden_plans')
      .select('id')
      .eq('user_id', userId)

    if (plansError) {
      results.eden_plans_select = { error: plansError.message }
    }

    const planIds = (plans ?? []).map((p) => p.id)

    // 2) Delete plan actions first (foreign key to eden_plans)
    if (planIds.length > 0) {
      const { error: actionsError, count } = await supabase
        .from('eden_plan_actions')
        .delete({ count: 'exact' })
        .in('plan_id', planIds)

      if (actionsError) {
        results.eden_plan_actions = { error: actionsError.message }
      } else {
        results.eden_plan_actions = { deleted: count ?? 0 }
      }
    }

    // 3) Delete plans
    {
      const { error, count } = await supabase
        .from('eden_plans')
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        results.eden_plans = { error: error.message }
      } else {
        results.eden_plans = { deleted: count ?? 0 }
      }
    }

    // 4) Load conversation ids for messages
    const { data: conversations, error: convSelectError } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', userId)

    if (convSelectError) {
      results.eden_conversations_select = { error: convSelectError.message }
    }

    const conversationIds = (conversations ?? []).map((c) => c.id)

    // 5) Delete messages (uses conversation_id, not user_id)
    if (conversationIds.length > 0) {
      const { error, count } = await supabase
        .from('eden_messages')
        .delete({ count: 'exact' })
        .in('conversation_id', conversationIds)

      if (error) {
        results.eden_messages = { error: error.message }
      } else {
        results.eden_messages = { deleted: count ?? 0 }
      }
    }

    // 6) Delete conversations
    {
      const { error, count } = await supabase
        .from('eden_conversations')
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        results.eden_conversations = { error: error.message }
      } else {
        results.eden_conversations = { deleted: count ?? 0 }
      }
    }

    // 7) Delete snapshots
    {
      const { error, count } = await supabase
        .from('eden_user_snapshots')
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        results.eden_user_snapshots = { error: error.message }
      } else {
        results.eden_user_snapshots = { deleted: count ?? 0 }
      }
    }

    // 8) Delete metric values
    {
      const { error, count } = await supabase
        .from('eden_metric_values')
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        results.eden_metric_values = { error: error.message }
      } else {
        results.eden_metric_values = { deleted: count ?? 0 }
      }
    }

    // 9) Delete profile
    {
      const { error, count } = await supabase
        .from('eden_user_profile')
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        results.eden_user_profile = { error: error.message }
      } else {
        results.eden_user_profile = { deleted: count ?? 0 }
      }
    }

    // 10) Delete persona
    {
      const { error, count } = await supabase
        .from('eden_user_personas')
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        results.eden_user_personas = { error: error.message }
      } else {
        results.eden_user_personas = { deleted: count ?? 0 }
      }
    }

    // 11) Delete Apple Health imports
    {
      const { error, count } = await supabase
        .from('apple_health_imports')
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        results.apple_health_imports = { error: error.message }
      } else {
        results.apple_health_imports = { deleted: count ?? 0 }
      }
    }

    console.log(`reset-user: results for user ${userId}:`, results)

    // Check if any errors occurred
    const hasErrors = Object.values(results).some(r => r.error)

    return NextResponse.json({ 
      ok: !hasErrors, 
      userId,
      results 
    })
  } catch (err) {
    console.error('reset-user: unexpected error', err)
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 })
  }
}
