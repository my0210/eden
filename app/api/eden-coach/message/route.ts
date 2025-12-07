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

const SYSTEM_PROMPT = `You are Eden, a health & performance coach focused on extending primespan (the years a person feels and performs at their best).

You will receive a JSON object called EDEN_CONTEXT with these fields:
- profile: basic facts and constraints about the user (age, sex at birth, height, weight, primary goal, injuries, time available, etc.).
- persona: a longer-term view of how this user tends to behave and what motivates them (may be null for now).
- snapshot: the current state of their metrics across heart, frame, metabolism, recovery, and mind.
- plan: the current weekly focus, with a short summary and a few concrete actions (may be null if no plan yet).
- profileComplete: whether the profile has enough information for safe, meaningful coaching.
- hasPlan: whether there is an active weekly plan for the current week.

Coaching rules:
- Use the snapshot and plan to decide what matters most over the next 1–2 weeks, not just today.
- If hasPlan is true, treat the plan as the default path unless the user clearly wants to change it. Use the plan actions as the backbone of your advice.
- If profileComplete is false and hasPlan is false, prioritise onboarding: ask a short sequence of questions (age, sex at birth, height, weight, main goal, time available, key constraints) before giving detailed plans.
- Ask one question at a time, reflect back what you heard, and keep the conversation focused.
- Be concrete and pragmatic. Avoid giving 20 different ideas; focus on 1–3 important moves.

Safety:
- Give specific, actionable coaching while staying safe (no medical diagnosis, encourage seeing a doctor for serious issues).
- Keep answers concise, practical, and encouraging.`

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

    // 3. Build Eden context (profile, snapshot, persona, plan)
    const { edenContext } = await buildEdenContext(supabase, user.id)
    const { profileComplete, hasPlan } = edenContext

    // 4. Get or create conversation
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

    // 5. Insert user message
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

    // 6. Fetch last ~10 messages for context
    const { data: recentMessages } = await supabase
      .from('eden_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10)

    // 7. Build OpenAI messages
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

    // Add conversation history (excluding the just-inserted user message which is last)
    if (recentMessages && recentMessages.length > 0) {
      for (const msg of recentMessages) {
        openaiMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
      }
    }

    // 8. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: openaiMessages,
      temperature: 0.7,
    })

    const replyText = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.'

    // 9. Insert assistant reply
    const { error: insertReplyError } = await supabase
      .from('eden_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: replyText,
      })

    if (insertReplyError) {
      console.error('Failed to insert assistant reply:', insertReplyError)
      // Continue anyway - we have the reply
    }

    // 10. Update conversation's last_message_at
    await supabase
      .from('eden_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // 11. Extract profile info from conversation if profile is incomplete
    // Runs after every turn while profile is incomplete, stops once profileComplete = true
    try {
      if (!profileComplete) {
        await deriveUserProfileFromMessages(supabase, user.id)
      }
    } catch (e) {
      console.error('eden-coach message route: deriveUserProfileFromMessages failed', e)
      // Don't fail the request - profile extraction is best-effort
    }

    // 12. Auto-create weekly plan if profile is complete but no plan exists
    // This runs in the background after the reply - user sees normal response,
    // and on the next turn Eden will have a plan in EDEN_CONTEXT
    try {
      if (profileComplete && !hasPlan) {
        await createWeeklyPlanForUser(supabase, user.id)
      }
    } catch (e) {
      console.error('eden-coach message route: createWeeklyPlanForUser failed', e)
      // Don't fail the request - plan creation is best-effort
    }

    // 13. Return reply
    return NextResponse.json({ reply: replyText })

  } catch (err) {
    console.error('Eden Coach error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
