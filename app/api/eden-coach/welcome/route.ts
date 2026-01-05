/**
 * Eden Coach Welcome Message
 * 
 * LLM-generated, personal, directional welcome.
 * Uses memory to create a coach-like first impression.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'
import { LLM_MODELS } from '@/lib/llm/models'
import { getOrCreateMemory } from '@/lib/coaching/memory'
import { buildWelcomeContext, hasActiveGoal, getUserName } from '@/lib/coaching/buildMemoryContext'

let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

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

const WELCOME_PROMPT = `You are Eden, a coach greeting someone after their health assessment.

TONE: Direct, confident, results-oriented. Warm but not fluffy. You're here to get them results, not be their friend.

Write 2-3 sentences that:
1. Greet them by name if you have it
2. Reference ONE specific thing you noticed (an injury, a goal, a gap - something real)
3. End with a direct question about what they want to achieve

NO generic excitement. NO "journey" talk. NO listing scores. Be specific and get to the point.

Example tone: "Hey Sarah. I saw you mentioned wanting to feel stronger but that knee has been holding you back. What's the main thing you want to tackle first?"

If you have no info, simply ask what they want to work on.`

/**
 * GET /api/eden-coach/welcome
 * 
 * Returns a personalized, LLM-generated welcome message.
 */
export async function GET() {
  try {
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load memory
    const memory = await getOrCreateMemory(supabase, user.id)
    const hasGoal = hasActiveGoal(memory)
    const userName = getUserName(memory)
    const welcomeContext = buildWelcomeContext(memory)

    let message: string
    let suggestions: string[]

    // If they already have a goal, give a different kind of welcome
    if (hasGoal) {
      const goalTitle = memory.confirmed.protocol?.goal_title || 'your goal'
      const week = memory.confirmed.protocol?.current_week || 1
      
      message = `Welcome back${userName ? `, ${userName}` : ''}! You're in week ${week} of ${goalTitle}. How's it going?`
      suggestions = ["Going well!", "I'm struggling", "Update me on progress"]
    } else {
      // Generate personalized welcome using LLM
      try {
        const completion = await getOpenAI().chat.completions.create({
          model: LLM_MODELS.STANDARD,
          messages: [
            { role: 'system', content: WELCOME_PROMPT },
            { role: 'user', content: `Here's what you know about this person:\n\n${welcomeContext || 'No information yet - they just started.'}` },
          ],
          temperature: 0.8,
          max_tokens: 300,
        })

        message = completion.choices[0]?.message?.content || getFallbackWelcome(userName)
      } catch (llmError) {
        console.error('LLM welcome failed:', llmError)
        message = getFallbackWelcome(userName)
      }

      // Default suggestions for goal-setting
      suggestions = ["Improve my fitness", "Sleep better", "Lose weight"]
    }

    return NextResponse.json({ 
      message,
      suggestions,
      hasActiveGoal: hasGoal,
    })

  } catch (err) {
    console.error('Welcome message error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function getFallbackWelcome(name: string | null): string {
  const greeting = name ? `Hey ${name}.` : 'Hey.'
  return `${greeting} I'm Eden, your coach. What do you want to work on?`
}
