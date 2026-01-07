import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { recordCompletion, undoCompletion } from '@/lib/coaching/weekInstance'

/**
 * POST /api/coaching/week-items/[id]/complete
 * Record a completion event for a week item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { id: itemId } = await params

    // Verify ownership
    const { data: item, error: fetchError } = await supabase
      .from('eden_week_items')
      .select('id, user_id, target_count, completed_count, completion_events')
      .eq('id', itemId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse optional notes from request body
    let notes: string | undefined
    try {
      const body = await request.json()
      notes = body.notes
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Record completion
    const result = await recordCompletion(supabase, itemId, notes)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Fetch updated item
    const { data: updatedItem } = await supabase
      .from('eden_week_items')
      .select('completed_count, completion_events')
      .eq('id', itemId)
      .single()

    return NextResponse.json({
      success: true,
      completed_count: updatedItem?.completed_count ?? item.completed_count + 1,
      completion_events: updatedItem?.completion_events ?? [],
    })

  } catch (error) {
    console.error('Complete week item error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/coaching/week-items/[id]/complete
 * Undo the last completion event for a week item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { id: itemId } = await params

    // Verify ownership
    const { data: item, error: fetchError } = await supabase
      .from('eden_week_items')
      .select('id, user_id, completed_count, completion_events')
      .eq('id', itemId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Undo completion
    const result = await undoCompletion(supabase, itemId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Fetch updated item
    const { data: updatedItem } = await supabase
      .from('eden_week_items')
      .select('completed_count, completion_events')
      .eq('id', itemId)
      .single()

    return NextResponse.json({
      success: true,
      completed_count: updatedItem?.completed_count ?? Math.max(0, item.completed_count - 1),
      completion_events: updatedItem?.completion_events ?? [],
    })

  } catch (error) {
    console.error('Undo week item completion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

