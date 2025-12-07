import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildEdenContext } from '@/lib/context/buildEdenContext'
import { deriveUserProfileFromMessages } from '@/lib/context/deriveUserProfileFromMessages'
import { createWeeklyPlanForUser } from '@/lib/plans/createWeeklyPlanForUser'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

type CoachRequestBody = {
  message: string
  channel?: 'web' | 'whatsapp'
}

const SYSTEM_PROMPT = `You are **Eden**, an expert health & performance coach focused on extending a person's **primespan** – the years where they feel and perform at their best.

### Your job
- Use the user's profile, health metrics, weekly plan, and conversation history to help them decide **what to focus on now** and **how to act this week**.
- Keep things practical, realistic, and humane. You are not a doctor, you are a coach.

### Context you receive
You may be given, as JSON or summaries:
- A **profile/persona** (age, sex at birth, height, weight, goals, preferences, constraints).
- A **health snapshot** across domains like Heart, Frame, Metabolism, Recovery, and Mind, including key metrics and recent trends.
- A **weekly plan** (focus summary + a few actions).
- Recent **conversation history**.

Treat all of this as your background understanding of the person. You don't need to repeat raw data back unless it's helpful to explain your reasoning.

### How to coach
- Sound like a thoughtful human coach, not a chatbot. Use natural language, short paragraphs, and concrete suggestions.
- Ask **one clear question at a time** when you need more information.
- Avoid repeating the same question if the user already answered it earlier in the conversation. If you're unsure, briefly confirm instead of re-asking from scratch.
- Prefer **fewer, higher-leverage actions** over long lists. It's better to give 2–3 good moves than 20 small tips.
- Acknowledge constraints (time, injuries, stress, travel) and adapt the plan rather than ignoring them.

### Using the weekly plan
- If you are given a weekly plan, treat it as a **current proposal or focus for this week**, based on their data.
- When you first use it, briefly introduce it in your own words, check whether it feels realistic, and invite adjustments.
- After the user accepts or seems comfortable with it, **don't keep re-printing the whole plan** unless they ask. Refer back to it briefly and shift into helping them implement it (e.g. schedule, tweaks, troubleshooting, accountability).

### Safety and boundaries
- You are not a doctor and cannot diagnose or prescribe. If something sounds like a medical issue, encourage the user to speak with a qualified healthcare professional.
- Avoid extreme or unsafe advice (extreme dieting, overtraining, ignoring pain).

### Style
- Encourage, don't lecture.
- Be specific and concrete ("3x/week 20–30 min walks after lunch") instead of vague ("move more").
- Occasionally summarise what you've understood about their context so far, especially after longer exchanges or plan changes.
- If information is missing or uncertain, say what you don't know and ask for clarification instead of guessing.`

export async function POST(req: NextRequest) {
  try {
    // 1. Parse request body
    const body: CoachRequestBody = await req.json()

    if (!body.message || body.message.trim() === '') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const channel = body.channel || 'web'

    // 2. Create Supabase client and authenticate
    const supabase = await getSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 3. Get or create conversation
    let conversationId: string

    const { data: existingConversation } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingConversation) {
      conversationId = existingConversation.id
    } else {
      const { data: newConversation, error: insertConvError } = await supabase
        .from('eden_conversations')
        .insert({
          user_id: user.id,
          channel: channel,
        })
        .select('id')
        .single()

      if (insertConvError || !newConversation) {
        console.error('Failed to create conversation:', insertConvError)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }

      conversationId = newConversation.id
    }

    // 4. Insert user message FIRST (so deriveProfile can see it)
    const { error: insertMsgError } = await supabase
      .from('eden_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: body.message,
      })

    if (insertMsgError) {
      console.error('Failed to insert user message:', insertMsgError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // 5. Extract profile info from conversation BEFORE building context
    // This ensures the context has the latest profile data
    try {
      await deriveUserProfileFromMessages(supabase, user.id)
    } catch (e) {
      console.error('deriveUserProfileFromMessages failed:', e)
      // Continue anyway - not critical
    }

    // 6. Build Eden context (now with potentially updated profile)
    const { edenContext } = await buildEdenContext(supabase, user.id)
    const { profileComplete, hasPlan } = edenContext

    // 7. Fetch last ~10 messages for context
    const { data: recentMessages } = await supabase
      .from('eden_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10)

    // 8. Build OpenAI messages
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    // System prompt
    openaiMessages.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    })

    // EDEN_CONTEXT as assistant message
    openaiMessages.push({
      role: 'assistant',
      content: `EDEN_CONTEXT: ${JSON.stringify(edenContext)}`,
    })

    // Plan context message
    if (edenContext.plan) {
      openaiMessages.push({
        role: 'assistant',
        content: 'Here is a suggested weekly plan for the user, represented as JSON. You should treat this as a plan you are proposing now based on their current profile and snapshot, not something they have already been following. When you respond, introduce it clearly (for example: "Based on what you\'ve told me, here\'s a simple plan for this week that I suggest for you"), briefly summarise the focus and key actions in natural language, and then ask how it feels and what they would adjust. Avoid phrases like "you already have a weekly plan". Plan JSON: ' + JSON.stringify(edenContext.plan),
      })
    } else {
      openaiMessages.push({
        role: 'assistant',
        content: 'There is no weekly plan yet. If the user seems new or unsure what to focus on, you can suggest creating a simple weekly focus for them. Keep it very manageable (a few high-impact actions) and check that it feels realistic.',
      })
    }

    // Add conversation history
    if (recentMessages && recentMessages.length > 0) {
      for (const msg of recentMessages) {
        openaiMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
      }
    }

    // 9. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: openaiMessages,
      temperature: 0.7,
    })

    const replyText = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.'

    // 10. Insert assistant reply
    const { error: insertReplyError } = await supabase
      .from('eden_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: replyText,
      })

    if (insertReplyError) {
      console.error('Failed to insert assistant reply:', insertReplyError)
    }

    // 11. Update conversation's last_message_at
    await supabase
      .from('eden_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // 12. Auto-create weekly plan if profile is complete but no plan exists
    try {
      if (profileComplete && !hasPlan) {
        await createWeeklyPlanForUser(supabase, user.id)
      }
    } catch (e) {
      console.error('createWeeklyPlanForUser failed:', e)
    }

    // 13. Return reply
    return NextResponse.json({ reply: replyText })

  } catch (err) {
    console.error('Eden Coach error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
