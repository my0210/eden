import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildEdenContext } from '@/lib/context/buildEdenContext'
import { domainDisplay } from '@/lib/prime-scorecard/metrics'
import { PRIME_DOMAINS } from '@/lib/prime-scorecard/types'

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
 * GET /api/eden-coach/welcome
 * 
 * Returns a concise, goal-oriented welcome message.
 */
export async function GET() {
  try {
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { edenContext } = await buildEdenContext(supabase, user.id)

    // Build concise welcome message
    const parts: string[] = []

    // Intro - avoid "health coach" terminology
    parts.push("Hey, I'm Eden. I'm here to help you feel and perform at your best.")
    parts.push("")

    // If they have a scorecard, give one insight
    if (edenContext.scorecard && edenContext.scorecard.prime_score !== null) {
      const sc = edenContext.scorecard
      
      // Find weakest domain with data
      const domainsWithScores = PRIME_DOMAINS
        .filter(d => sc.domain_scores[d] !== null)
        .sort((a, b) => (sc.domain_scores[a] ?? 100) - (sc.domain_scores[b] ?? 100))
      
      if (domainsWithScores.length > 0) {
        const weakest = domainsWithScores[0]
        const weakestScore = sc.domain_scores[weakest]
        const weakestLabel = domainDisplay[weakest].label
        
        parts.push(`Based on your Prime Check, **${weakestLabel}** (${weakestScore}) looks like an area with room to grow.`)
        parts.push("")
      }
    }

    // Soft nudge toward goal
    parts.push("What would you like to work on? I'll help you set a clear goal and build a plan to get there.")

    return NextResponse.json({ 
      message: parts.join("\n"),
      hasScorecard: edenContext.hasScorecard,
      hasActiveGoal: edenContext.hasActiveGoal,
    })

  } catch (err) {
    console.error('Welcome message error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
