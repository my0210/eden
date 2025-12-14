import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildEdenContext, EdenContext } from '@/lib/context/buildEdenContext'
import { domainDisplay } from '@/lib/prime-scorecard/metrics'
import { PRIME_DOMAINS } from '@/lib/prime-scorecard/types'

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
 * Generate a deterministic welcome message based on the user's context.
 * This is grounded in the scorecard and focus - no data requests.
 */
function generateWelcomeMessage(ctx: EdenContext): string {
  const parts: string[] = []
  
  // Greeting
  parts.push("Welcome to Eden! I'm here to help you optimize your health and extend your primespan. 🌿")
  parts.push("")

  // Acknowledge what we know
  if (ctx.scorecard) {
    const sc = ctx.scorecard
    const confLabel = sc.prime_confidence >= 80 ? 'high' : sc.prime_confidence >= 50 ? 'moderate' : 'limited'
    
    if (sc.prime_score !== null) {
      parts.push(`**Your Prime Scorecard** shows a score of **${sc.prime_score}** with ${confLabel} confidence, based on ${sc.evidence_summary.total_metrics} metrics across ${sc.evidence_summary.domains_with_data} domain${sc.evidence_summary.domains_with_data !== 1 ? 's' : ''}.`)
    } else {
      parts.push(`I've set up your **Prime Scorecard**, though we don't have enough data yet to calculate an overall score.`)
    }
    parts.push("")

    // Domain observations (only those with data)
    const observations: string[] = []
    for (const domain of PRIME_DOMAINS) {
      const score = sc.domain_scores[domain]
      const label = domainDisplay[domain].label
      
      if (score !== null) {
        if (score >= 70) {
          observations.push(`Your **${label}** looks strong at ${score}`)
        } else if (score >= 50) {
          observations.push(`Your **${label}** is moderate at ${score}`)
        } else {
          observations.push(`Your **${label}** could use attention at ${score}`)
        }
      }
    }

    if (observations.length > 0) {
      parts.push("**What I'm seeing:**")
      for (const obs of observations) {
        parts.push(`• ${obs}`)
      }
      parts.push("")
    }

    // Note what's missing (but don't ask for it)
    const missingDomains = PRIME_DOMAINS.filter(d => sc.domain_scores[d] === null)
    if (missingDomains.length > 0 && missingDomains.length < 5) {
      const missingLabels = missingDomains.map(d => domainDisplay[d].label).join(', ')
      parts.push(`*We don't have data yet for ${missingLabels}, so those scores aren't calculated yet.*`)
      parts.push("")
    }
  } else {
    parts.push("I don't have much health data yet, so I'll start with some universal foundations that help everyone.")
    parts.push("")
  }

  // Focus-aligned suggestion
  const focus = ctx.focus.primary || 'overall health'
  
  parts.push("**Let's get started:**")
  
  if (ctx.scorecard && ctx.scorecard.prime_score !== null) {
    // Tailor to their focus and weakest domain
    const weakestDomain = PRIME_DOMAINS
      .filter(d => ctx.scorecard!.domain_scores[d] !== null)
      .sort((a, b) => (ctx.scorecard!.domain_scores[a] ?? 100) - (ctx.scorecard!.domain_scores[b] ?? 100))[0]
    
    if (weakestDomain) {
      const weakLabel = domainDisplay[weakestDomain].label
      parts.push(`Based on your focus on **${focus}** and your ${weakLabel} score, here are 2-3 things that could make a real difference:`)
      parts.push("")
      
      // Give conservative, universal suggestions based on weakest domain
      switch (weakestDomain) {
        case 'heart':
          parts.push("1. **Add 20 minutes of zone 2 cardio** (brisk walking, easy cycling) 3x/week")
          parts.push("2. **Practice nasal breathing** during low-intensity exercise to improve efficiency")
          break
        case 'frame':
          parts.push("1. **Start with 2 strength sessions per week** focusing on compound movements")
          parts.push("2. **Add daily mobility work** – even 5 minutes of stretching helps")
          break
        case 'metabolism':
          parts.push("1. **Focus on protein at every meal** – aim for palm-sized portions")
          parts.push("2. **Add a 10-min walk after meals** to improve glucose response")
          break
        case 'recovery':
          parts.push("1. **Set a consistent sleep schedule** – same bed/wake time ±30 min")
          parts.push("2. **Create a wind-down routine** – dim lights, no screens 1hr before bed")
          break
        case 'mind':
          parts.push("1. **Add 5 minutes of morning stillness** – meditation, journaling, or just sitting")
          parts.push("2. **Take short breaks** every 90 minutes during focused work")
          break
      }
    } else {
      // Has score but no domain data (shouldn't happen, but fallback)
      parts.push(`Since you're focusing on **${focus}**, here are some foundational habits:`)
      parts.push("")
      parts.push("1. **Sleep consistency** – same bed/wake time, 7-8 hours")
      parts.push("2. **Daily movement** – even a 20-min walk makes a difference")
      parts.push("3. **Protein with each meal** – supports energy and recovery")
    }
  } else {
    // No scorecard data - give universal safe foundations
    parts.push(`Since we're just getting started, here are foundational habits that benefit everyone focusing on **${focus}**:`)
    parts.push("")
    parts.push("1. **Sleep consistency** – same bed/wake time, 7-8 hours")
    parts.push("2. **Daily movement** – even a 20-min walk makes a difference")
    parts.push("3. **Protein with each meal** – supports energy and recovery")
  }
  
  parts.push("")
  parts.push("What would you like to focus on first? Or tell me what's on your mind – I'm here to help.")

  return parts.join("\n")
}

/**
 * GET /api/eden-coach/welcome
 * 
 * Returns the deterministic welcome message for a user.
 * This is grounded in their Prime Scorecard, focus, and context.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build context (read-only)
    const { edenContext } = await buildEdenContext(supabase, user.id)

    // Generate deterministic welcome message
    const welcomeMessage = generateWelcomeMessage(edenContext)

    return NextResponse.json({ 
      message: welcomeMessage,
      focus: edenContext.focus,
      hasScorecard: edenContext.hasScorecard
    })

  } catch (err) {
    console.error('Welcome message error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

