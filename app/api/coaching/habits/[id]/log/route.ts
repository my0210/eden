import { NextRequest, NextResponse } from 'next/server'
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

// Helper to extract user_id from nested query result
function getUserIdFromHabit(habit: unknown): string | null {
  try {
    const h = habit as {
      eden_protocols: {
        eden_goals: { user_id: string }
      }
    }
    return h.eden_protocols?.eden_goals?.user_id ?? null
  } catch {
    return null
  }
}

// Log habit completion
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: habitId } = await params
    const body = await req.json()
    const { date, completed = true, notes } = body

    const logDate = date || new Date().toISOString().slice(0, 10)

    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this habit
    const { data: habit } = await supabase
      .from('eden_habits')
      .select(`
        id,
        current_streak,
        best_streak,
        last_logged_at,
        eden_protocols!inner (
          goal_id,
          eden_goals!inner (
            user_id
          )
        )
      `)
      .eq('id', habitId)
      .single()

    const ownerId = getUserIdFromHabit(habit)
    if (!habit || ownerId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Insert or update log
    const { error: logError } = await supabase
      .from('eden_habit_logs')
      .upsert({
        habit_id: habitId,
        logged_date: logDate,
        completed,
        notes: notes || null,
      }, {
        onConflict: 'habit_id,logged_date',
      })

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 })
    }

    // Calculate new streak
    let newStreak = habit.current_streak || 0
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    if (completed && logDate === today) {
      // Check if yesterday was logged
      const { data: yesterdayLog } = await supabase
        .from('eden_habit_logs')
        .select('completed')
        .eq('habit_id', habitId)
        .eq('logged_date', yesterday)
        .eq('completed', true)
        .maybeSingle()

      if (yesterdayLog || habit.last_logged_at === yesterday) {
        newStreak = (habit.current_streak || 0) + 1
      } else {
        newStreak = 1 // Reset streak
      }

      // Update habit streak
      const { error: updateError } = await supabase
        .from('eden_habits')
        .update({
          current_streak: newStreak,
          best_streak: Math.max(habit.best_streak || 0, newStreak),
          last_logged_at: logDate,
        })
        .eq('id', habitId)

      if (updateError) {
        console.error('Failed to update streak:', updateError)
      }
    }

    return NextResponse.json({ 
      success: true,
      current_streak: newStreak,
      best_streak: Math.max(habit.best_streak || 0, newStreak),
    })
  } catch (error) {
    console.error('Log habit error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Remove habit log
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: habitId } = await params
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

    const supabase = await getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: habit } = await supabase
      .from('eden_habits')
      .select(`
        id,
        eden_protocols!inner (
          goal_id,
          eden_goals!inner (
            user_id
          )
        )
      `)
      .eq('id', habitId)
      .single()

    const ownerId = getUserIdFromHabit(habit)
    if (!habit || ownerId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Delete log
    const { error } = await supabase
      .from('eden_habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('logged_date', date)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculate streak (simplified - just reset if today was the log)
    const today = new Date().toISOString().slice(0, 10)
    if (date === today) {
      await supabase
        .from('eden_habits')
        .update({ current_streak: 0 })
        .eq('id', habitId)
    }

    return NextResponse.json({ success: true, current_streak: 0 })
  } catch (error) {
    console.error('Delete habit log error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
