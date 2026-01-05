/**
 * User Memory API
 * 
 * Read, update, and delete memory items.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { 
  getMemory, 
  removeStatedFact, 
  removeInferredPattern, 
  addStatedFact,
  clearMemory 
} from '@/lib/coaching/memory'

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

/**
 * GET /api/user/memory
 * 
 * Returns the user's memory
 */
export async function GET() {
  try {
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memory = await getMemory(supabase, user.id)
    
    if (!memory) {
      return NextResponse.json({ 
        confirmed: {},
        stated: [],
        inferred: [],
        notable_events: []
      })
    }

    return NextResponse.json({
      confirmed: memory.confirmed,
      stated: memory.stated,
      inferred: memory.inferred,
      notable_events: memory.notable_events,
      updated_at: memory.updated_at
    })

  } catch (err) {
    console.error('Memory fetch error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/user/memory
 * 
 * Add a new stated fact
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fact } = body

    if (!fact || typeof fact !== 'string') {
      return NextResponse.json({ error: 'fact is required' }, { status: 400 })
    }

    await addStatedFact(supabase, user.id, fact.trim(), 'chat')

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Memory add error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * DELETE /api/user/memory
 * 
 * Remove a stated fact or inferred pattern, or clear all memory
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'stated', 'inferred', or 'all'
    const text = searchParams.get('text')

    if (type === 'all') {
      await clearMemory(supabase, user.id)
      return NextResponse.json({ success: true })
    }

    if (!type || !text) {
      return NextResponse.json({ error: 'type and text are required' }, { status: 400 })
    }

    if (type === 'stated') {
      await removeStatedFact(supabase, user.id, text)
    } else if (type === 'inferred') {
      await removeInferredPattern(supabase, user.id, text)
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Memory delete error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

