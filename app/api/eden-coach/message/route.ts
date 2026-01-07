/**
 * Eden Coach Message Handler
 * 
 * Simplified flow:
 * 1. Load memory
 * 2. Build context from memory
 * 3. Call LLM (no special markers)
 * 4. Extract and apply patches to memory
 * 5. Handle goal creation if detected
 * 6. Generate suggestions
 * 7. Return response
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'
import { LLM_MODELS } from '@/lib/llm/models'
import { getOrCreateMemory, applyMemoryPatches, updateConfirmed, addNotableEvent, setBaselineSnapshot } from '@/lib/coaching/memory'
import { buildMemoryContext, hasActiveGoal as checkHasActiveGoal, hasDomainSelection as checkHasDomainSelection, getDomainSelection } from '@/lib/coaching/buildMemoryContext'
import { extractFromChat, GoalData } from '@/lib/coaching/extractFromChat'
import { generateProtocolForGoal } from '@/lib/coaching/generateProtocol'
import { Goal } from '@/lib/coaching/types'

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

// Simple system prompt - trust the LLM
const SYSTEM_PROMPT = `You are Eden, a coach who helps people feel and perform at their best.

CONVERSATION STYLE:
- Keep responses concise - 2-3 sentences typical
- No markdown formatting - plain conversational text
- ONE QUESTION AT A TIME - never ask multiple questions in one message
- When a conversation reaches a natural end, close warmly without forcing another question
- It's okay to just acknowledge, encourage, or summarize without asking anything

CRITICAL: Ask only ONE question per message. If you need multiple pieces of information, gather them across multiple exchanges. This is essential for good conversation flow.

Be direct, curious, warm. Think Peter Attia or Andrew Huberman tone.

You're not a doctor - suggest professionals for medical concerns.

Your memory of this person is provided below.`

// Additional context based on coaching state
function getCoachingStatePrompt(hasGoal: boolean, hasDomains: boolean, domains: { primary: string; secondary?: string | null } | null): string {
  if (hasGoal) {
    return `
COACHING STATE: HAS ACTIVE PROTOCOL
Support them - answer questions, encourage progress, troubleshoot blockers. Don't interrogate.`
  }
  
  if (hasDomains && domains) {
    const domainList = domains.secondary 
      ? `${domains.primary.toUpperCase()} (primary) and ${domains.secondary.toUpperCase()} (secondary)`
      : domains.primary.toUpperCase()
    
    return `
COACHING STATE: DOMAINS SELECTED - READY TO CREATE PROTOCOL
This person chose their focus areas: ${domainList}.

Your job: gather enough context to create their personalized protocol, then DO IT.

RULES:
- Ask ONE question per message - never combine multiple questions
- You need to know: (1) their current routine, (2) schedule OR equipment OR challenges
- After 2-3 exchanges, you MUST have enough info to create their protocol
- When you have enough info, say something like "Perfect, I have what I need. Let me build your ${domains.primary} protocol..."

Good questions (ask ONE at a time):
- "What does your current [domain] routine look like?" (ALWAYS ask first)
- "When can you dedicate time to this?" OR "What equipment do you have access to?"

DO NOT:
- Keep asking endless questions - 2-3 exchanges max
- Ask generic "what brought you here" - they already chose ${domains.primary}
- Wait for perfect information - we can adapt the protocol later`
  }
  
  // No domains, no goal - truly new user
  return `
COACHING STATE: NO FOCUS SELECTED
Help them identify what matters most. Ask questions to understand their situation, then recommend focus areas from the 5 Prime domains: Heart, Frame, Metabolism, Recovery, Mind.`
}

// Suggestions prompt
const SUGGESTIONS_PROMPT = `Generate 2-3 short reply suggestions (1-6 words each) based on the conversation.
Match what the coach just asked or said. Be specific to the context.
Return JSON: {"suggestions": ["Option 1", "Option 2", "Option 3"]}`

type CoachRequestBody = {
  message: string
  channel?: 'web' | 'whatsapp'
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

    // 1. Load memory
    const memory = await getOrCreateMemory(supabase, user.id)
    const memoryContext = buildMemoryContext(memory)
    const hasGoal = checkHasActiveGoal(memory)
    const hasDomains = checkHasDomainSelection(memory)
    const domains = getDomainSelection(memory)

    // 2. Get or create conversation
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

    // 3. Insert user message
    await supabase
      .from('eden_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: body.message,
      })

    // 4. Fetch recent messages for context
    const { data: recentMsgs } = await supabase
      .from('eden_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(12)

    const messages = (recentMsgs?.reverse() ?? [])

    // 5. Build OpenAI messages
    const coachingStatePrompt = getCoachingStatePrompt(hasGoal, hasDomains, domains)
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT + coachingStatePrompt },
      { role: 'system', content: `## About this person\n${memoryContext}` },
    ]

    // Add conversation history
    for (const msg of messages) {
      openaiMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })
    }

    // 6. Call LLM
    const completion = await getOpenAI().chat.completions.create({
      model: LLM_MODELS.REASONING,
      messages: openaiMessages,
      temperature: 0.7,
    })

    let replyText = completion.choices[0]?.message?.content || 'I could not generate a response.'

    // 7. Extract information from conversation
    const currentGoalTitle = memory.confirmed.protocol?.goal_title
    const extraction = await extractFromChat(
      messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      replyText,
      currentGoalTitle
    )

    // 8. Apply patches to memory
    if (Object.keys(extraction.patches).length > 0) {
      await applyMemoryPatches(supabase, user.id, extraction.patches)
    }

    // 9. Handle goal creation if detected
    if (extraction.actions.createGoal && !hasGoal) {
      const goalData = extraction.actions.createGoal
      
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
            constraints_json: { other: goalData.constraints || [] },
            status: 'active',
            started_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (!goalError && newGoal) {
          // Generate protocol
          const protocolResult = await generateProtocolForGoal(
            supabase,
            user.id,
            newGoal as Goal
          )

          // Update memory with protocol info
          await updateConfirmed(supabase, user.id, 'protocol', {
            goal_id: newGoal.id,
            goal_title: goalData.target_description,
            goal_type: goalData.goal_type,
            duration_weeks: goalData.duration_weeks,
            started_at: new Date().toISOString(),
            current_week: 1,
            current_phase: 1,
            total_phases: protocolResult.milestones?.length || 3,
            actions_done: 0,
            actions_total: protocolResult.actions?.length || 0,
          })

          // Set baseline snapshot
          await setBaselineSnapshot(supabase, user.id)

          // Add notable event
          await addNotableEvent(supabase, user.id, {
            date: new Date().toISOString(),
            description: `Started goal: ${goalData.target_description}`,
            source: 'protocol'
          })

          // Update reply with success message
          replyText = `Done! Your goal is set: **${goalData.target_description}** over ${goalData.duration_weeks} weeks.

I've created your personalized plan with ${protocolResult.milestones?.length || 0} milestones and ${protocolResult.actions?.length || 0} weekly actions.

**Check the Coaching tab** to see your full plan and start tracking progress!`
        }
      } catch (dbError) {
        console.error('Database error creating goal:', dbError)
      }
    }

    // 9b. Handle domain protocol creation if detected
    if (extraction.actions.createDomainProtocol && !hasGoal && hasDomains && domains) {
      const protocolData = extraction.actions.createDomainProtocol
      const domainName = domains.primary.charAt(0).toUpperCase() + domains.primary.slice(1)
      
      try {
        // Create domain goal
        const { data: newGoal, error: goalError } = await supabase
          .from('eden_goals')
          .insert({
            user_id: user.id,
            goal_type: 'domain',
            domain: domains.primary,
            priority: 1,
            target_description: `${domainName} Protocol`,
            duration_weeks: 8,
            constraints_json: {
              current_routine: protocolData.current_routine,
              schedule: protocolData.schedule_availability,
              equipment: protocolData.equipment_access,
              challenges: protocolData.specific_challenges,
            },
            status: 'active',
            started_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (!goalError && newGoal) {
          // Generate protocol
          const protocolResult = await generateProtocolForGoal(
            supabase,
            user.id,
            newGoal as Goal
          )

          // Update memory with protocol info
          await updateConfirmed(supabase, user.id, 'protocol', {
            goal_id: newGoal.id,
            goal_title: `${domainName} Protocol`,
            goal_type: 'domain',
            duration_weeks: 8,
            started_at: new Date().toISOString(),
            current_week: 1,
            current_phase: 1,
            total_phases: protocolResult.milestones?.length || 3,
            actions_done: 0,
            actions_total: protocolResult.actions?.length || 0,
          })

          // Set baseline snapshot
          await setBaselineSnapshot(supabase, user.id)

          // Add notable event
          await addNotableEvent(supabase, user.id, {
            date: new Date().toISOString(),
            description: `Started ${domainName} protocol`,
            source: 'protocol'
          })

          // Update reply with success message
          replyText = `Done! I've created your ${domainName} protocol.

Based on what you told me, I've built an 8-week plan with ${protocolResult.milestones?.length || 0} milestones and ${protocolResult.actions?.length || 0} weekly actions.

Check the Coaching tab to see your plan and start tracking!`
        }
      } catch (dbError) {
        console.error('Database error creating domain protocol:', dbError)
      }
    }

    // 10. Handle action completion if detected
    if (extraction.actions.completeAction && currentGoalTitle) {
      const actionTitle = extraction.actions.completeAction.actionTitle
      
      // Find and mark action complete
      const { data: protocol } = await supabase
        .from('eden_protocols')
        .select('id')
        .eq('goal_id', memory.confirmed.protocol?.goal_id)
        .eq('status', 'active')
        .maybeSingle()

      if (protocol) {
        const { data: action } = await supabase
          .from('eden_protocol_actions')
          .select('id')
          .eq('protocol_id', protocol.id)
          .ilike('title', `%${actionTitle}%`)
          .is('completed_at', null)
          .limit(1)
          .maybeSingle()

        if (action) {
          await supabase
            .from('eden_protocol_actions')
            .update({ completed_at: new Date().toISOString() })
            .eq('id', action.id)

          // Update memory with new action count
          const currentDone = memory.confirmed.protocol?.actions_done || 0
          await applyMemoryPatches(supabase, user.id, {
            update_confirmed: { 'protocol.actions_done': currentDone + 1 }
          })

          // Add notable event
          await addNotableEvent(supabase, user.id, {
            date: new Date().toISOString(),
            description: `Completed: ${actionTitle}`,
            source: 'protocol'
          })
        }
      }
    }

    // 11. Generate suggestions
    const suggestions = await generateSuggestions(replyText, body.message, hasGoal)

    // 12. Insert assistant reply
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

/**
 * Generate suggestions
 */
async function generateSuggestions(
  coachMessage: string,
  userMessage: string,
  hasGoal: boolean
): Promise<string[]> {
  try {
    const context = hasGoal 
      ? "User has an active goal - in coaching mode."
      : "User setting up a new goal."
    
    const completion = await getOpenAI().chat.completions.create({
      model: LLM_MODELS.SUGGESTIONS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SUGGESTIONS_PROMPT },
        { role: 'user', content: `${context}\n\nUser said: "${userMessage}"\n\nCoach said:\n${coachMessage}` },
      ],
      temperature: 0.7,
      max_tokens: 100,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) return []

    const parsed = JSON.parse(responseText)
    if (!Array.isArray(parsed.suggestions)) return []

    return parsed.suggestions
      .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 3)
  } catch (error) {
    console.error('Failed to generate suggestions:', error)
    return []
  }
}
