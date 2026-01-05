import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { initializeMemory } from '@/lib/coaching/initializeMemory'

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
 * POST /api/dev/init-memory
 * 
 * Manually trigger memory initialization from onboarding data.
 * Useful when memory was cleared but onboarding wasn't reset.
 */
export async function POST() {
  try {
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('init-memory: initializing memory for user', user.id)

    await initializeMemory(supabase, user.id)

    console.log('init-memory: success for user', user.id)

    return NextResponse.json({ 
      ok: true, 
      message: 'Memory initialized from onboarding data' 
    })

  } catch (err) {
    console.error('init-memory error:', err)
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Internal error' 
    }, { status: 500 })
  }
}

