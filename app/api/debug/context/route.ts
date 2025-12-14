import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { loadScorecardInputs } from '@/lib/prime-scorecard/inputs'

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
 * GET /api/debug/context
 * 
 * Returns the scorecard inputs for debugging.
 * Does NOT write to the database.
 * 
 * This replaces the old /api/debug/snapshot endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get the user's scorecard inputs (READ-ONLY)
    const inputs = await loadScorecardInputs(supabase, user.id)

    return NextResponse.json(inputs)
  } catch (err) {
    console.error('Error getting scorecard inputs:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

