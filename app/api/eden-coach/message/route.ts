import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildEdenContext, summarizeContextForCoach } from '@/lib/context/buildEdenContext'
import { generateProtocolForGoal } from '@/lib/coaching/generateProtocol'
import { extractGoalFromConversation } from '@/lib/coaching/extractGoalFromConversation'
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

type CoachRequestBody = {
  message: string
  channel?: 'web' | 'whatsapp'
}

/**
 * Extract JSON object from text starting with [COMMIT_GOAL]{...}
 * Handles nested braces properly by counting brace depth
 */
function extractCommitGoalJson(text: string): string | null {
  const startMarker = '[COMMIT_GOAL]{'
  const startIdx = text.indexOf(startMarker)
  if (startIdx === -1) return null

  // Find the opening brace after the marker
  const jsonStart = startIdx + startMarker.length - 1 // -1 because we want the {
  let depth = 0
  let i = jsonStart

  while (i < text.length) {
    const char = text[i]
    
    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        // Found matching closing brace
        return text.substring(jsonStart, i + 1)
      }
    }
    
    i++
  }

  // Didn't find matching brace - might be incomplete
  return null
}

// Concise, goal-focused system prompt (no suggestion instructions - handled separately)
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

If they confirm (yes, let's do it, commit, etc.), respond with ONLY this line:
[COMMIT_GOAL]{"goal_type":"outcome","target_description":"...","duration_weeks":N,"domain":null,"constraints":{"injuries":[],"time_restrictions":[],"equipment_limitations":[],"red_lines":[],"other":[]}}

Do NOT add any other text before or after this line. The JSON must have proper nested braces.

goal_type can be: "domain" (improve heart/frame/metabolism/recovery/mind), "outcome" (specific achievement), or "composite" (overall health)
domain should be "heart", "frame", "metabolism", "recovery", "mind", or null for non-domain goals

## If User HAS an Active Goal
- Reference their protocol and progress
- Encourage wins, troubleshoot struggles
- Keep responses short and actionable
- If they want to change their goal, they can abandon and start fresh`

// Prompt for generating suggestions (using max intelligence)
const SUGGESTIONS_PROMPT = `You generate quick reply suggestions for a health coaching chat.

Given the conversation context, suggest 2-3 short replies the user might want to send.

Rules:
- Each suggestion should be 1-6 words max
- Make them specific and actionable
- Match the context of what the coach just asked
- Answer the LAST question Eden asked (target/timeline/constraints/confirmation/next step)
- Avoid repeating what the user just said
- If coach asks for constraints → suggest constraint examples
- If coach asks for timeline → suggest durations (4 weeks, 8 weeks, 12 weeks)
- If coach asks for target → suggest specific outcomes
- If coach confirms plan creation → suggest next steps (e.g., "View my plan", "What's next?")
- If in coaching mode → suggest progress-related responses

Respond with ONLY valid JSON in this exact format:
{"suggestions": ["Option 1", "Option 2", "Option 3"]}`

/**
 * Generate suggestions using max-intelligence model
 */
async function generateSuggestions(
  coachMessage: string,
  userMessage: string,
  hasActiveGoal: boolean,
  goalSummary?: string
): Promise<string[]> {
  try {
    const modeContext = hasActiveGoal 
      ? "User has an active goal and is in coaching mode."
      : "User is setting up a new goal (needs target, timeline, constraints)."
    
    let contextParts = [
      `Mode: ${modeContext}`,
      `User's last message: "${userMessage}"`,
      `Coach's message:\n${coachMessage}`,
    ]
    
    if (goalSummary) {
      contextParts.push(`Current goal: ${goalSummary}`)
    }

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SUGGESTIONS_PROMPT },
        { role: 'user', content: contextParts.join('\n\n') },
      ],
      temperature: 0.7,
      max_tokens: 150,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) return []

    const parsed = JSON.parse(responseText)
    if (!Array.isArray(parsed.suggestions)) {
      return []
    }

    // Validate and clean suggestions
    let suggestions = parsed.suggestions
      .filter((s: any): s is string => typeof s === 'string' && s.trim().length > 0) // Remove empty strings
      .map((s: string) => s.trim()) // Trim whitespace
      .filter((s: string, idx: number, arr: string[]) => {
        // De-duplicate (case-insensitive)
        const lower = s.toLowerCase()
        return arr.findIndex(item => item.toLowerCase() === lower) === idx
      })
      .slice(0, 3) // Hard cap at 3

    return suggestions
  } catch (error) {
    console.error('Failed to generate suggestions:', error)
    return []
  }
}

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
      let goalData: any = null
      let commitSuccess = false

      // Try robust JSON extraction first
      const jsonStr = extractCommitGoalJson(replyText)
      if (jsonStr) {
        try {
          goalData = JSON.parse(jsonStr)
          commitSuccess = true
        } catch (parseError) {
          console.error('Failed to parse extracted JSON:', parseError, 'Extracted:', jsonStr)
        }
      }

      // Fallback: if parsing failed, try extraction from conversation
      if (!commitSuccess) {
        console.log('Commit JSON parse failed, attempting fallback extraction from conversation')
        
        // Reuse the context we already built
        const essentials = edenContext.essentials
        
        // Build conversation context for extraction
        const conversationMessages = [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: body.message },
        ]

        // Convert height/weight based on units if needed
        let heightCm: number | undefined = undefined
        let weightKg: number | undefined = undefined
        
        if (essentials.height !== null) {
          if (essentials.units === 'imperial') {
            // Convert inches to cm
            heightCm = essentials.height * 2.54
          } else {
            // Assume metric (cm)
            heightCm = essentials.height
          }
        }
        
        if (essentials.weight !== null) {
          if (essentials.units === 'imperial') {
            // Convert lbs to kg
            weightKg = essentials.weight * 0.453592
          } else {
            // Assume metric (kg)
            weightKg = essentials.weight
          }
        }

        const extractionResult = await extractGoalFromConversation({
          messages: conversationMessages,
          user_essentials: {
            age: essentials.age || undefined,
            sex_at_birth: essentials.sex_at_birth || undefined,
            weight: weightKg,
            height: heightCm,
          },
          current_scorecard: edenContext.scorecard ? {
            prime_score: edenContext.scorecard.prime_score,
            domain_scores: edenContext.scorecard.domain_scores,
          } : undefined,
        })

        if (extractionResult.success && extractionResult.goal) {
          // Convert ExtractedGoal to the format we need
          goalData = {
            goal_type: extractionResult.goal.goal_type,
            domain: extractionResult.goal.domain || null,
            target_description: extractionResult.goal.target_description,
            duration_weeks: extractionResult.goal.duration_weeks,
            constraints: extractionResult.goal.constraints || {},
          }
          commitSuccess = true
          console.log('Fallback extraction succeeded')
        } else {
          console.error('Fallback extraction failed:', extractionResult.missing)
        }
      }

      // If we have goal data, create the goal
      if (commitSuccess && goalData) {
        try {
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
            replyText = "I tried to create your goal but something went wrong. Let's try again - can you confirm your goal one more time?"
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
        } catch (dbError) {
          console.error('Database error creating goal:', dbError)
          replyText = "I tried to create your goal but something went wrong. Let's try again - can you confirm your goal one more time?"
        }
      } else {
        // Both parsing and extraction failed
        const missingFields = goalData?.missing || ['target', 'timeline', 'constraints']
        replyText = `I understood you want to commit, but I need a bit more clarity. Can you tell me:\n\n${missingFields.map((f: string) => `- ${f}`).join('\n')}`
      }

      // Remove the [COMMIT_GOAL] marker from reply text if it's still there
      replyText = replyText.replace(/\[COMMIT_GOAL\][\s\S]*$/i, '').trim()
    }

    // Clean up any stray markers from reply text
    replyText = replyText.replace(/\[SUGGESTIONS\]\s*\[[\s\S]*?\](?:\s*$|\n)?/i, '').trim()
    replyText = replyText.replace(/\[COMMIT_GOAL\][\s\S]*$/i, '').trim()

    // Build goal summary if available
    let goalSummary: string | undefined = undefined
    if (hasActiveGoal && edenContext.goal) {
      goalSummary = `${edenContext.goal.target_description} (${edenContext.goal.duration_weeks} weeks)`
    }

    // Generate suggestions using max-intelligence model call
    const suggestions = await generateSuggestions(replyText, body.message, hasActiveGoal, goalSummary)

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
