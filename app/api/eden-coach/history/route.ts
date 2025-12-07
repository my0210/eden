import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

export async function GET() {
  try {
    const supabase = await getSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get the user's web conversation
    const { data: conversation } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel', 'web')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conversation) {
      return NextResponse.json({ messages: [] })
    }

    // Get messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('eden_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (messagesError) {
      console.error('Failed to fetch messages:', messagesError)
      return NextResponse.json({ messages: [] })
    }

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })),
    })
  } catch (err) {
    console.error('History fetch error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

