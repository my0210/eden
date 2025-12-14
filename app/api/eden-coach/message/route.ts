import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildEdenContext, EdenContext, summarizeContextForCoach } from '@/lib/context/buildEdenContext'
import { domainDisplay } from '@/lib/prime-scorecard/metrics'
import { PRIME_DOMAINS } from '@/lib/prime-scorecard/types'
import OpenAI from 'openai'

// Lazy initialization to avoid build-time errors when env var isn't set
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

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

const SYSTEM_PROMPT = `You are **Eden**, an expert health & performance coach focused on extending a person's **primespan** – the years where they actually feel strong, clear, and able to do what they care about.

### Your job
- Help the user figure out **what matters most right now** and **what to actually do about it**.
- Keep things practical, realistic, and humane. You are not a doctor, you are a coach.

### Context you receive
You'll receive a structured summary of what Eden knows about this person. This includes:
- **Essentials**: age, sex, height, weight
- **Focus**: their primary/secondary health focus areas
- **Safety Rails**: any conditions, medications, injuries, or restrictions
- **Prime Scorecard**: their current health score across 5 domains (Heart, Frame, Metabolism, Recovery, Mind) with confidence levels
- **Uploads**: what data they've imported

### Critical Rules
1. **Never claim a metric exists unless it appears in the Prime Scorecard evidence.**
2. **If confidence is low, use cautious language** ("based on limited data", "we don't have much visibility into...").
3. **Do NOT ask for more data in your first message.** Provide value with what you have.
4. **Honor safety rails absolutely.** If they have injuries, restrictions, or red lines, respect them.
5. **Focus on their stated focus area** when making suggestions.

### How to coach
- Sound like a thoughtful human, not a chatbot. Short paragraphs, natural language.
- Ask **one question at a time**. Don't rapid-fire.
- If they already told you something, don't ask again – acknowledge it and build on it.
- Give **1-3 concrete suggestions**, not 10 vague ideas.
- Acknowledge real constraints (time, energy, injuries) and work around them.

### On weekly plans
- If there's a plan, use it as a reference point – but don't keep re-printing it.
- If there's no plan yet, that's fine. Get to know them first.

### Safety
- You're not a doctor. Don't diagnose. If something sounds medical, suggest they see a professional.
- No extreme advice (crash diets, overtraining, ignoring pain).

### Style
- Warm but direct. Encouraging, not preachy.
- Specific beats vague: "20-min walk after lunch 3x/week" > "move more"
- When unsure, say so and ask.`

/**
 * Generate a deterministic first message based on the context.
 * This is grounded in the scorecard and focus - no data requests.
 */
function generateFirstMessage(ctx: EdenContext): string {
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
      const conf = sc.domain_confidence[domain]
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
    let isNewConversation = false

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
      isNewConversation = true
    }

    // 4. Check if this is the first message in the conversation
    const { count: existingMessageCount } = await supabase
      .from('eden_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    const isFirstMessage = isNewConversation || (existingMessageCount ?? 0) === 0

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

    // 6. Build Eden context (read-only, includes Prime Scorecard + focus)
    // NOTE: deriveUserProfileFromMessages is DISABLED - onboarding essentials are the source of truth
    const { edenContext } = await buildEdenContext(supabase, user.id)

    // 7. Fetch last ~10 messages for context (most recent, then reverse for chronological order)
    const { data: recentMessagesRaw } = await supabase
      .from('eden_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    // Reverse to get chronological order (oldest to newest)
    const recentMessages = recentMessagesRaw?.reverse() ?? []

    // 8. Build OpenAI messages
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    // System prompt
    openaiMessages.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    })

    // Context summary (v2: includes Prime Scorecard + focus)
    const contextSummary = summarizeContextForCoach(edenContext)
    openaiMessages.push({
      role: 'system',
      content: `Here's what Eden knows about this person:\n\n${contextSummary}`,
    })

    // If first message, add the deterministic first assistant message as context
    // This ensures the AI knows what was already said and doesn't repeat it
    if (isFirstMessage) {
      const firstMessage = generateFirstMessage(edenContext)
      
      // Insert the first message into the database
      await supabase
        .from('eden_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: firstMessage,
        })

      // Add it to OpenAI context
      openaiMessages.push({
        role: 'assistant',
        content: firstMessage,
      })

      // Add the user's message (already in recentMessages, but ensure it's after the assistant)
      openaiMessages.push({
        role: 'user',
        content: body.message,
      })

      // Special instruction for follow-up
      openaiMessages.push({
        role: 'system',
        content: `You just gave the user their first welcome message with initial observations and suggestions. Now respond naturally to their reply. Do NOT repeat the welcome or scorecard summary. Do NOT ask for more data. Build on what you started.`,
      })
    } else {
      // Add conversation history
      for (const msg of recentMessages) {
        openaiMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
      }
    }

    // 9. Call OpenAI
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: openaiMessages,
      temperature: 0.7,
    })

    const replyText = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.'

    // 10. Insert assistant reply (unless it was the first message which we already inserted)
    if (!isFirstMessage) {
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
    } else {
      // For first message, insert the OpenAI follow-up response
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
    }

    // 11. Update conversation's last_message_at
    await supabase
      .from('eden_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // 12. Return reply (for first message, return the first message + the follow-up)
    if (isFirstMessage) {
      const firstMessage = generateFirstMessage(edenContext)
      return NextResponse.json({ 
        reply: replyText,
        firstMessage: firstMessage 
      })
    }

    return NextResponse.json({ reply: replyText })

  } catch (err) {
    console.error('Eden Coach error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
