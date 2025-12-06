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

const SYSTEM_PROMPT = `You are Eden, an AI health and performance coach focused on primespan (healthy, high-performance years). You receive: (1) a JSON snapshot of the user's current health metrics and trends, (2) an optional persona text describing their goals, constraints, and tendencies, and (3) the last few chat messages. You must give specific, actionable coaching while staying safe (no medical diagnosis, encourage seeing a doctor for serious issues). Keep answers concise, practical, and encouraging.`

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

    // 5. Fetch user snapshot
    const snapshot = await getUserSnapshot(supabase, user.id)

    // 6. Fetch user persona (if any)
    const { data: personaData } = await supabase
      .from('eden_user_personas')
      .select('persona_text')
      .eq('user_id', user.id)
      .maybeSingle()

    const personaText = personaData?.persona_text || null

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

    // Context message with snapshot and persona
    let contextContent = `User snapshot JSON: ${JSON.stringify(snapshot)}`
    if (personaText) {
      contextContent += `\n\nUser persona: ${personaText}`
    }
    openaiMessages.push({
      role: 'assistant',
      content: contextContent,
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
      // Continue anyway - we have the reply
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

