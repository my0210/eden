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
import { buildWelcomeContext, hasActiveGoal, getUserName, hasDomainSelection, getDomainSelection } from '@/lib/coaching/buildMemoryContext'
import { initializeMemory } from '@/lib/coaching/initializeMemory'

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

const WELCOME_PROMPT = `You are Eden, a coach - think Peter Attia meets Andrew Huberman.

TONE: Thoughtful, curious, intellectually engaged. Human, not corporate.

Write 2-3 sentences that:
1. Greet them naturally (use name if you have it)
2. Reference ONE specific thing from their info (not a score)
3. End with ONE clear question

CRITICAL: Ask only ONE question. Never combine multiple questions.

Example: "Hey Marcus. I noticed sleep has been rough for you lately. What's your biggest challenge there - falling asleep, staying asleep, or waking up tired?"

If no info: "Hey! I'm Eden. What's the one thing you'd most like to improve about how you feel day-to-day?"`

const DOMAIN_SELECTED_PROMPT = `You are Eden, a coach - think Peter Attia meets Andrew Huberman.

This person chose their focus areas and is ready to start. You need to gather info to personalize their plan.

Write 2 sentences:
1. Acknowledge their chosen PRIMARY domain
2. Ask ONE specific question about their current situation in that domain

CRITICAL: Ask only ONE question. Never ask multiple things at once.

Examples:
- HEART: "Great choice focusing on Heart. What does your current cardio look like - any regular activity, or starting fresh?"
- FRAME: "Frame as your focus - nice. How many days a week are you currently lifting, if at all?"
- RECOVERY: "Prioritizing Recovery is smart. Are your sleep issues more about falling asleep or staying asleep?"
- METABOLISM: "Metabolism focus - got it. How would you describe your current eating pattern?"
- MIND: "Mind as your focus makes sense. What's your biggest cognitive challenge - focus, stress, or energy?"`

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
    let memory = await getOrCreateMemory(supabase, user.id)
    
    // Check if memory needs to be refreshed (domain selection in user_state but not in memory)
    if (!hasDomainSelection(memory)) {
      const { data: userState } = await supabase
        .from('eden_user_state')
        .select('coaching_json, onboarding_status')
        .eq('user_id', user.id)
        .maybeSingle()
      
      // If user completed onboarding and has domain selection in state but not in memory, reinitialize
      const coachingJson = userState?.coaching_json as { domain_selection?: unknown } | null
      if (userState?.onboarding_status === 'completed' && coachingJson?.domain_selection) {
        console.log('Welcome: reinitializing memory for user (domain_selection missing)', user.id)
        await initializeMemory(supabase, user.id)
        memory = await getOrCreateMemory(supabase, user.id)
      }
    }
    
    const hasGoal = hasActiveGoal(memory)
    const hasDomains = hasDomainSelection(memory)
    const domains = getDomainSelection(memory)
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
    } else if (hasDomains && domains) {
      // User has selected domains but no protocol yet - personalize for their choice
      const domainContext = domains.secondary
        ? `Primary focus: ${domains.primary.toUpperCase()}, Secondary focus: ${domains.secondary.toUpperCase()}`
        : `Primary focus: ${domains.primary.toUpperCase()}`
      
      try {
        const completion = await getOpenAI().chat.completions.create({
          model: LLM_MODELS.STANDARD,
          messages: [
            { role: 'system', content: DOMAIN_SELECTED_PROMPT },
            { role: 'user', content: `Person info:\n${welcomeContext}\n\nChosen domains: ${domainContext}` },
          ],
          temperature: 0.8,
          max_tokens: 200,
        })

        message = completion.choices[0]?.message?.content || getDomainFallbackWelcome(userName, domains.primary)
      } catch (llmError) {
        console.error('LLM domain welcome failed:', llmError)
        message = getDomainFallbackWelcome(userName, domains.primary)
      }

      // Domain-specific suggestions based on primary domain
      suggestions = getDomainSuggestions(domains.primary)
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
  return `${greeting} I'm Eden. I'm curious - what brought you here? What's the thing you actually want to change?`
}

function getDomainFallbackWelcome(name: string | null, domain: string): string {
  const greeting = name ? `Hey ${name}!` : 'Hey!'
  const domainName = domain.charAt(0).toUpperCase() + domain.slice(1)
  
  const domainQuestions: Record<string, string> = {
    heart: "Do you have any current cardio routine, or are we building from scratch?",
    frame: "What's your current relationship with strength training - regular gym-goer, occasional, or just starting?",
    metabolism: "Are you looking to optimize an already decent diet, or do a bigger overhaul?",
    recovery: "Are your sleep struggles more about falling asleep, staying asleep, or waking up refreshed?",
    mind: "What does your stress or focus challenge look like day-to-day?",
  }
  
  const question = domainQuestions[domain.toLowerCase()] || "What does your current routine look like in this area?"
  
  return `${greeting} Great choice prioritizing ${domainName}. Before I build your plan - ${question}`
}

function getDomainSuggestions(domain: string): string[] {
  const suggestions: Record<string, string[]> = {
    heart: ["No cardio right now", "I run/walk occasionally", "Already pretty active"],
    frame: ["Beginner to weights", "I lift sometimes", "Regular gym-goer"],
    metabolism: ["My diet needs work", "Pretty clean, want to optimize", "Just curious about tracking"],
    recovery: ["Trouble falling asleep", "Wake up during night", "Never feel rested"],
    mind: ["High stress at work", "Focus is my issue", "General mental clarity"],
  }
  
  return suggestions[domain.toLowerCase()] || ["Tell me more about my options", "What would the plan look like?", "Let's start simple"]
}
