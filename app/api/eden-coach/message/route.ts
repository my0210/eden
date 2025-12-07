import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildEdenContext, EdenContext } from '@/lib/context/buildEdenContext'
import { deriveUserProfileFromMessages } from '@/lib/context/deriveUserProfileFromMessages'
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

const SYSTEM_PROMPT = `You are **Eden**, an expert health & performance coach focused on extending a person's **primespan** – the years where they actually feel strong, clear, and able to do what they care about, not just how long they live or what their lab numbers are.

### Your job
- Help the user figure out **what matters most right now** and **what to actually do about it**.
- Keep things practical, realistic, and humane. You are not a doctor, you are a coach.

### Context you receive
You'll receive a brief summary of what Eden knows about this person. Use it as background – don't recite it back unless it helps explain your thinking. The context includes:
- **Profile**: basics like age, goals, constraints, time available.
- **Health snapshot**: their current state across Heart, Frame, Metabolism, Recovery, and Mind.
- **Weekly plan**: if one exists, it's a focus they're working on this week.

### How to coach
- Sound like a thoughtful human, not a chatbot. Short paragraphs, natural language.
- Ask **one question at a time**. Don't rapid-fire.
- If they already told you something, don't ask again – acknowledge it and build on it.
- Give **1-3 concrete suggestions**, not 10 vague ideas.
- Acknowledge real constraints (time, energy, injuries) and work around them.

### On weekly plans
- If there's a plan, use it as a reference point – but don't keep re-printing it.
- If there's no plan yet, that's fine. Get to know them first. A plan can come later when it makes sense.
- Never rush someone into a plan. Understanding their situation matters more.

### Safety
- You're not a doctor. Don't diagnose. If something sounds medical, suggest they see a professional.
- No extreme advice (crash diets, overtraining, ignoring pain).

### Style
- Warm but direct. Encouraging, not preachy.
- Specific beats vague: "20-min walk after lunch 3x/week" > "move more"
- When unsure, say so and ask.`

// Build a natural language context summary instead of raw JSON
function summarizeContext(ctx: EdenContext): string {
  const parts: string[] = []

  // Profile summary (from the profile record, not snapshot)
  if (ctx.profile) {
    const p = ctx.profile as Record<string, unknown>
    const profileBits: string[] = []
    if (p.first_name) profileBits.push(`Name: ${p.first_name}`)
    if (p.age) profileBits.push(`${p.age} years old`)
    if (p.sex_at_birth) profileBits.push(`${p.sex_at_birth}`)
    if (p.height_cm) profileBits.push(`${p.height_cm}cm`)
    if (p.weight_kg) profileBits.push(`${p.weight_kg}kg`)
    if (p.primary_goal) profileBits.push(`Goal: ${p.primary_goal}`)
    if (p.weekly_training_time_hours) profileBits.push(`Available: ~${p.weekly_training_time_hours}h/week for training`)
    
    if (profileBits.length > 0) {
      parts.push(`**Profile**: ${profileBits.join(', ')}`)
    } else {
      parts.push(`**Profile**: Not much known yet.`)
    }
  } else {
    parts.push(`**Profile**: New user, nothing known yet.`)
  }

  // Health snapshot summary
  if (ctx.snapshot?.metrics && ctx.snapshot.metrics.length > 0) {
    const metricSummaries: string[] = []
    for (const m of ctx.snapshot.metrics) {
      if (m.latestValue !== null) {
        const unit = m.unit ? ` ${m.unit}` : ''
        metricSummaries.push(`${m.metricCode}: ${m.latestValue}${unit}`)
      }
    }
    if (metricSummaries.length > 0) {
      parts.push(`**Health data**: ${metricSummaries.join(', ')}`)
    }
  } else {
    parts.push(`**Health data**: None uploaded yet.`)
  }

  // Plan summary
  if (ctx.plan && ctx.hasPlan) {
    const actionTitles = ctx.plan.actions.map(a => a.title).join('; ')
    parts.push(`**This week's focus**: ${ctx.plan.focusSummary || 'No summary'}. Actions: ${actionTitles || 'none'}`)
  } else {
    parts.push(`**Weekly plan**: None yet.`)
  }

  return parts.join('\n')
}

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
    try {
      await deriveUserProfileFromMessages(supabase, user.id)
    } catch (e) {
      console.error('deriveUserProfileFromMessages failed:', e)
      // Continue anyway - not critical
    }

    // 6. Build Eden context (now with potentially updated profile)
    const { edenContext } = await buildEdenContext(supabase, user.id)

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

    // Context as a natural language summary (not raw JSON)
    const contextSummary = summarizeContext(edenContext)
    openaiMessages.push({
      role: 'system',
      content: `Here's what Eden knows about this person:\n\n${contextSummary}`,
    })

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

    // 12. Return reply
    return NextResponse.json({ reply: replyText })

  } catch (err) {
    console.error('Eden Coach error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
