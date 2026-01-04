import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildEdenContext, summarizeContextForCoach } from '@/lib/context/buildEdenContext'
import { generateProtocolForGoal } from '@/lib/coaching/generateProtocol'
import { Goal } from '@/lib/coaching/types'
import OpenAI from 'openai'

// Lazy initialization
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

function buildFallbackSuggestions(params: {
  replyText: string
  hasActiveGoal: boolean
}): string[] {
  const r = (params.replyText || '').toLowerCase()

  // Goal-setting flow (no active goal)
  if (!params.hasActiveGoal) {
    const asksTarget = r.includes('target') || r.includes('specific outcome') || r.includes('outcome')
    const asksTimeline = r.includes('timeline') || r.includes('how many weeks') || r.includes('weeks')
    const asksConstraints =
      r.includes('constraints') ||
      r.includes('injur') ||
      r.includes('time restriction') ||
      r.includes("won't do") ||
      r.includes('limitations')

    // If Eden asked for target + timeline + constraints in one go, give one option for each
    if (asksTarget && asksTimeline && asksConstraints) {
      return ['Drop 3–5 kg', '8 weeks', 'No injuries']
    }

    if (r.includes('ready to commit') || (r.includes('commit') && r.includes('?'))) {
      return ["Yes, let's do it", 'Change something', 'Not ready yet']
    }

    if (asksTimeline) {
      return ['4 weeks', '8 weeks', '12 weeks']
    }

    if (asksConstraints) {
      return ['No injuries', 'Limited time', 'Bad knee']
    }

    if (asksTarget) {
      return ['Drop 5% body fat', 'Waist -5 cm', 'Lose 3 kg']
    }

    if (r.includes('what would you like to work on') || r.includes('what would you like to focus')) {
      return ['Get lean', 'Sleep better', 'Build strength']
    }

    // Generic but still aligned with goal-setting
    return ["Here's my goal", '8 weeks', 'No injuries']
  }

  // Coaching flow (has active goal)
  if (r.includes('what’s making') || r.includes("what's making") || r.includes('what is making')) {
    return ['Time', 'Energy', 'Motivation']
  }

  if (r.includes('how are you doing') || r.includes('how am i doing') || r.includes('this week')) {
    return ['Good week', 'So-so week', 'Rough week']
  }

  if (r.includes('change') || r.includes('update') || r.includes('adapt')) {
    return ['Small tweak', 'Bigger change', 'Keep it as-is']
  }

  return ['How am I doing?', "I'm struggling", "What's next?"]
}

type CoachRequestBody = {
  message: string
  channel?: 'web' | 'whatsapp'
}

// Concise, goal-focused system prompt
const SYSTEM_PROMPT = `You are Eden, helping users commit to goals and follow through.

## Your Approach
- Warm but direct. No fluff.
- One question at a time.
- Specific beats vague: "20-min walk after lunch" > "move more"

## Safety
- You're not a doctor. Suggest professionals for medical concerns.
- Honor all constraints absolutely (injuries, limitations, red lines).

## If User Has NO Active Goal
Help them define ONE clear goal by gathering:
1. **Target**: What specific outcome? (e.g., "run 5K", "lose 10 lbs", "improve sleep")
2. **Timeline**: How many weeks? (typically 4-12)
3. **Constraints**: Injuries, time limits, things they won't do

Once you have all three, present a summary:
"Here's your goal: [description]. Timeline: [X] weeks. Constraints: [list]. Ready to commit?"

If they confirm (yes, let's do it, commit, etc.), respond with EXACTLY this format:
[COMMIT_GOAL]{"goal_type":"outcome","target_description":"...","duration_weeks":N,"domain":null,"constraints":{"injuries":[],"time_restrictions":[],"equipment_limitations":[],"red_lines":[],"other":[]}}

goal_type can be: "domain" (improve heart/frame/metabolism/recovery/mind), "outcome" (specific achievement), or "composite" (overall health)
domain should be "heart", "frame", "metabolism", "recovery", "mind", or null for non-domain goals

## If User HAS an Active Goal
- Reference their protocol and progress
- Encourage wins, troubleshoot struggles
- Keep responses short and actionable
- If they want to change their goal, they can abandon and start fresh

## REQUIRED: Suggested Replies
You MUST end EVERY response with exactly this format on its own line:
[SUGGESTIONS]["Option 1", "Option 2", "Option 3"]

This is mandatory. Never skip it. Examples:
- Goals question: [SUGGESTIONS]["Improve my cardio", "Sleep better", "Build strength"]
- Timeline question: [SUGGESTIONS]["4 weeks", "8 weeks", "12 weeks"]
- Constraints question: [SUGGESTIONS]["No injuries", "Bad knees", "Limited time"]
- Confirm commitment: [SUGGESTIONS]["Yes, let's do it", "Change something", "Not ready yet"]
- General follow-up: [SUGGESTIONS]["Tell me more", "What's next?", "I have a question"]`

export async function POST(req: NextRequest) {
  try {
    const body: CoachRequestBody = await req.json()

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const channel = body.channel || 'web'
    const supabase = await getSupabase()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get or create conversation
    let conversationId: string

    const { data: existingConv } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingConv) {
      conversationId = existingConv.id
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('eden_conversations')
        .insert({ user_id: user.id, channel })
        .select('id')
        .single()

      if (convError || !newConv) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }
      conversationId = newConv.id
    }

    // Insert user message
    await supabase
      .from('eden_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: body.message,
      })

    // Build context
    const { edenContext } = await buildEdenContext(supabase, user.id)
    const contextSummary = summarizeContextForCoach(edenContext)

    // Build state summary for the prompt
    const hasActiveGoal = edenContext.hasActiveGoal
    let stateSummary = `## Current State\n`
    
    if (hasActiveGoal && edenContext.goal) {
      stateSummary += `- **Has Active Goal**: Yes\n`
      stateSummary += `- **Goal**: ${edenContext.goal.target_description}\n`
      stateSummary += `- **Duration**: ${edenContext.goal.duration_weeks} weeks\n`
      
      if (edenContext.protocol) {
        stateSummary += `- **Protocol Phase**: ${edenContext.protocol.current_phase}/${edenContext.protocol.total_phases}\n`
        stateSummary += `- **This Week**: ${edenContext.protocol.weekly_adherence.actions_completed}/${edenContext.protocol.weekly_adherence.actions_total} actions done\n`
      }
      
      if (edenContext.goal.constraints) {
        const c = edenContext.goal.constraints
        const constraintParts: string[] = []
        if (c.injuries?.length) constraintParts.push(`Injuries: ${c.injuries.join(', ')}`)
        if (c.time_restrictions?.length) constraintParts.push(`Time: ${c.time_restrictions.join(', ')}`)
        if (c.red_lines?.length) constraintParts.push(`Won't do: ${c.red_lines.join(', ')}`)
        if (constraintParts.length) {
          stateSummary += `- **Constraints**: ${constraintParts.join('; ')}\n`
        }
      }
    } else {
      stateSummary += `- **Has Active Goal**: No\n`
      stateSummary += `- Help them define a goal (target, timeline, constraints)\n`
    }

    // Fetch recent messages
    const { data: recentMsgs } = await supabase
      .from('eden_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(12)

    const messages = (recentMsgs?.reverse() ?? [])

    // Build OpenAI messages
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: stateSummary },
      { role: 'system', content: `## User Context\n${contextSummary}` },
    ]

      // Add conversation history
    for (const msg of messages) {
        openaiMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
    }

    // Call OpenAI
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      temperature: 0.7,
    })

    let replyText = completion.choices[0]?.message?.content || 'I could not generate a response.'

    // Check for goal commitment
    if (replyText.includes('[COMMIT_GOAL]')) {
      const match = replyText.match(/\[COMMIT_GOAL\](\{[\s\S]*?\})/)
      
      if (match) {
        try {
          const goalData = JSON.parse(match[1])
          
          // Create goal in database
          const { data: newGoal, error: goalError } = await supabase
            .from('eden_goals')
        .insert({
              user_id: user.id,
              goal_type: goalData.goal_type || 'outcome',
              domain: goalData.domain || null,
              target_description: goalData.target_description,
              duration_weeks: goalData.duration_weeks || 8,
              constraints_json: goalData.constraints || {},
              status: 'active',
              started_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (goalError || !newGoal) {
            console.error('Failed to create goal:', goalError)
            replyText = replyText.replace(/\[COMMIT_GOAL\]\{[\s\S]*?\}/, 
              "I tried to create your goal but something went wrong. Let's try again - can you confirm your goal one more time?")
          } else {
            // Generate protocol
            const protocolResult = await generateProtocolForGoal(
              supabase,
              user.id,
              newGoal as Goal
            )

            if (protocolResult.success) {
              replyText = `Done! Your goal is set: **${goalData.target_description}** over ${goalData.duration_weeks} weeks.

I've created your personalized plan with ${protocolResult.milestones?.length || 0} milestones, ${protocolResult.actions?.length || 0} weekly actions, and ${protocolResult.habits?.length || 0} daily habits.

**Check the Coaching tab** to see your full plan and start tracking progress!`
            } else {
              replyText = `Your goal is saved: **${goalData.target_description}**. 

I'm still setting up your detailed plan - check the Coaching tab in a moment.`
            }
          }
        } catch (parseError) {
          console.error('Failed to parse goal JSON:', parseError)
          replyText = replyText.replace(/\[COMMIT_GOAL\]\{[\s\S]*?\}/, 
            "I understood you want to commit, but I had trouble processing the details. Can you confirm your goal one more time?")
        }
      }
    }

    // Parse suggestions from response (handle various formats)
    let suggestions: string[] = []
    // Match [SUGGESTIONS] followed by a JSON array, allowing newlines and whitespace
    const suggestionsMatch = replyText.match(/\[SUGGESTIONS\]\s*(\[[\s\S]*?\])(?:\s*$|\n)/i)
    if (suggestionsMatch) {
      try {
        suggestions = JSON.parse(suggestionsMatch[1])
        // Remove suggestions from the reply text
        replyText = replyText.replace(/\[SUGGESTIONS\]\s*\[[\s\S]*?\](?:\s*$|\n)?/i, '').trim()
      } catch (e) {
        console.log('Failed to parse suggestions:', suggestionsMatch[1], e)
      }
    }
    
    // Fallback: if no suggestions found, provide contextual defaults
    if (suggestions.length === 0) {
      suggestions = buildFallbackSuggestions({ replyText, hasActiveGoal })
    }

    // Insert assistant reply (without suggestions marker)
    await supabase
        .from('eden_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: replyText,
        })

    // Update conversation timestamp
    await supabase
      .from('eden_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({ reply: replyText, suggestions })

  } catch (err) {
    console.error('Eden Coach error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
