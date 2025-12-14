import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createWeeklyPlanForUser } from '@/lib/plans/createWeeklyPlanForUser'

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create weekly plan
    const plan = await createWeeklyPlanForUser(supabase, user.id)

    return NextResponse.json({ plan }, { status: 200 })
  } catch (err: unknown) {
    console.error('Failed to create weekly plan:', err)

    const message =
      err instanceof Error ? err.message : 'Internal error'

    // Map known errors to user-friendly messages
    const errorMap: Record<string, { msg: string; status: number }> = {
      CONTEXT_UNAVAILABLE: {
        msg: 'Unable to build your context. Please ensure you have some metrics or profile data.',
        status: 400,
      },
      LLM_NO_RESPONSE: {
        msg: 'The AI coach did not respond. Please try again.',
        status: 502,
      },
      LLM_INVALID_JSON: {
        msg: 'The AI coach returned an invalid response. Please try again.',
        status: 502,
      },
      LLM_INVALID_STRUCTURE: {
        msg: 'The AI coach returned an unexpected format. Please try again.',
        status: 502,
      },
      DB_INSERT_PLAN_FAILED: {
        msg: 'Failed to save your plan. Please try again.',
        status: 500,
      },
    }

    const mapped = errorMap[message]
    if (mapped) {
      return NextResponse.json({ error: mapped.msg }, { status: mapped.status })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

