import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getUserSnapshot } from '@/lib/context/getUserSnapshot'
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

You receive three main pieces of context as JSON in a message labelled EDEN_CONTEXT:
1) profile: basics about the user (age, sex at birth, height, weight, goals, constraints).
2) snapshot: a summary of their current metrics and derived scores across heart, frame, metabolism, recovery, and mind.
3) plan: the current weekly focus, including a short summary and a handful of concrete actions.

Use this context to answer in a clear, coaching style. Respect the current weekly plan as the default path unless the user clearly wants to change it. Be concrete, avoid giving 20 different ideas, and prioritise what will matter most for the next 1–2 weeks.

Onboarding behaviour:
- If the profile is thin or missing (hasProfile is false or profile is null) and there is no active weekly plan, start by asking a small sequence of onboarding questions instead of jumping into detailed advice.
- Ask for: age, sex at birth (for interpreting metrics), height and weight, main goal, and rough weekly time available for training/recovery.
- Ask one question at a time, summarise back what you learned, and only then move to setting a clear focus for the first week.
- You cannot directly write to databases; treat what the user tells you as conversation context and repeat key facts back so they feel heard.

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

    // 4. Insert user message
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

    // 5. Fetch user profile
    let profile = null
    try {
      const { data: profileData } = await supabase
        .from('eden_user_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      profile = profileData
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    }

    const hasProfile = !!profile

    // 6. Fetch user snapshot
    let snapshot = null
    try {
      snapshot = await getUserSnapshot(supabase, user.id)
    } catch (err) {
      console.error('Failed to fetch snapshot:', err)
    }

    // 7. Fetch active weekly plan for today
    const today = new Date().toISOString().slice(0, 10)

    let activePlan = null
    try {
      const { data: activePlans, error: planError } = await supabase
        .from('eden_plans')
        .select('id, start_date, end_date, status, focus_summary')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('start_date', { ascending: false })
        .limit(1)

      if (planError) {
        console.error('Failed to fetch active plan:', planError)
      }

      activePlan = activePlans?.[0] ?? null
    } catch (err) {
      console.error('Failed to fetch active plan:', err)
    }

    // 8. Fetch plan actions if plan exists
    let planActions: Array<{
      title: string
      description: string | null
      metric_code: string | null
      target_value: string | null
      cadence: string | null
    }> = []

    if (activePlan) {
      try {
        const { data: actionsData, error: actionsError } = await supabase
          .from('eden_plan_actions')
          .select('title, description, metric_code, target_value, cadence')
          .eq('plan_id', activePlan.id)
          .order('priority', { ascending: true })

        if (actionsError) {
          console.error('Failed to fetch plan actions:', actionsError)
        }

        planActions = actionsData ?? []
      } catch (err) {
        console.error('Failed to fetch plan actions:', err)
      }
    }

    // 9. Build context objects
    const planContext = activePlan
      ? {
          focusSummary: activePlan.focus_summary,
          startDate: activePlan.start_date,
          endDate: activePlan.end_date,
          actions: planActions,
        }
      : null

    const profileContext = profile ? { ...profile } : null
    const snapshotContext = snapshot ?? null

    const edenContext = {
      hasProfile,
      profile: profileContext,
      snapshot: snapshotContext,
      plan: planContext,
    }

    // 10. Fetch last ~10 messages for context
    const { data: recentMessages } = await supabase
      .from('eden_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10)

    // 11. Build OpenAI messages
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    // System prompt
    openaiMessages.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    })

    // Combined context message
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

    // 12. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: openaiMessages,
      temperature: 0.7,
    })

    const replyText = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.'

    // 13. Insert assistant reply
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

    // 14. Update conversation's last_message_at
    await supabase
      .from('eden_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // 15. Return reply
    return NextResponse.json({ reply: replyText })

  } catch (err) {
    console.error('Eden Coach error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
