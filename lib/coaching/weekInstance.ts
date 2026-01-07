/**
 * Week Instance Management
 * 
 * Creates and manages frozen weekly snapshots of protocols.
 * Once a week instance is created, it's immutable.
 * Protocol changes affect the NEXT week, not the current one.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { PrimeScorecard } from '@/lib/prime-scorecard/types'

// ============================================================================
// Types
// ============================================================================

export interface ProtocolWeek {
  id: string
  user_id: string
  protocol_id: string
  protocol_version: number
  week_start: string // DATE
  scorecard_snapshot_json: PrimeScorecard | null
  status: 'active' | 'completed' | 'skipped'
  created_at: string
}

export interface WeekItem {
  id: string
  user_id: string
  week_id: string
  source_action_id: string | null
  item_type: 'action' | 'habit'
  title: string
  description: string | null
  target_value: string | null
  success_criteria: string | null
  fallback: string | null
  target_count: number
  completed_count: number
  completion_events: CompletionEvent[]
  skipped_at: string | null
  skip_reason: string | null
  created_at: string
}

export interface CompletionEvent {
  at: string // ISO timestamp
  notes?: string
}

export interface CreateWeekInstanceInput {
  userId: string
  protocolId: string
  protocolVersion: number
  weekStart: Date
  scorecardSnapshot?: PrimeScorecard
}

export interface CreateWeekInstanceResult {
  success: boolean
  weekId?: string
  week?: ProtocolWeek
  items?: WeekItem[]
  error?: string
}

// ============================================================================
// Week Instance Creation
// ============================================================================

/**
 * Create a new week instance for a protocol
 * 
 * This creates a frozen snapshot of the protocol for a specific week.
 * The week items are resolved from the protocol's actions.
 */
export async function createWeekInstance(
  supabase: SupabaseClient,
  input: CreateWeekInstanceInput
): Promise<CreateWeekInstanceResult> {
  const { userId, protocolId, protocolVersion, weekStart, scorecardSnapshot } = input

  // Format week_start as DATE (YYYY-MM-DD)
  const weekStartStr = weekStart.toISOString().slice(0, 10)

  try {
    // Check if week already exists
    const { data: existing } = await supabase
      .from('eden_protocol_weeks')
      .select('id')
      .eq('protocol_id', protocolId)
      .eq('week_start', weekStartStr)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Week instance already exists for this date' }
    }

    // Get protocol actions to resolve into week items
    const { data: actions, error: actionsError } = await supabase
      .from('eden_protocol_actions')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('priority', { ascending: true })

    if (actionsError) {
      console.error('Failed to fetch protocol actions:', actionsError)
      return { success: false, error: 'Failed to fetch protocol actions' }
    }

    // Create week instance
    const { data: week, error: weekError } = await supabase
      .from('eden_protocol_weeks')
      .insert({
        user_id: userId,
        protocol_id: protocolId,
        protocol_version: protocolVersion,
        week_start: weekStartStr,
        scorecard_snapshot_json: scorecardSnapshot || null,
        status: 'active',
      })
      .select()
      .single()

    if (weekError || !week) {
      console.error('Failed to create week instance:', weekError)
      return { success: false, error: 'Failed to create week instance' }
    }

    // Create week items from protocol actions
    const weekItemsData = (actions || []).map(action => ({
      user_id: userId,
      week_id: week.id,
      source_action_id: action.id,
      item_type: 'action' as const,
      title: action.title,
      description: action.description,
      target_value: action.target_value,
      success_criteria: null, // Could be added to protocol_actions
      fallback: null, // Could be added to protocol_actions
      target_count: parseTargetCount(action.cadence),
      completed_count: 0,
      completion_events: [],
    }))

    const { data: items, error: itemsError } = await supabase
      .from('eden_week_items')
      .insert(weekItemsData)
      .select()

    if (itemsError) {
      console.error('Failed to create week items:', itemsError)
      // Week was created but items failed - not fatal
    }

    return {
      success: true,
      weekId: week.id,
      week: week as ProtocolWeek,
      items: (items || []) as WeekItem[],
    }

  } catch (error) {
    console.error('Create week instance failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// Week Instance Queries
// ============================================================================

/**
 * Get the current active week for a protocol
 */
export async function getCurrentWeek(
  supabase: SupabaseClient,
  protocolId: string
): Promise<ProtocolWeek | null> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('eden_protocol_weeks')
    .select('*')
    .eq('protocol_id', protocolId)
    .eq('status', 'active')
    .lte('week_start', today)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Failed to get current week:', error)
    return null
  }

  return data as ProtocolWeek | null
}

/**
 * Get all week instances for a protocol
 */
export async function getWeekHistory(
  supabase: SupabaseClient,
  protocolId: string
): Promise<ProtocolWeek[]> {
  const { data, error } = await supabase
    .from('eden_protocol_weeks')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('week_start', { ascending: false })

  if (error) {
    console.error('Failed to get week history:', error)
    return []
  }

  return (data || []) as ProtocolWeek[]
}

/**
 * Get week items for a specific week
 */
export async function getWeekItems(
  supabase: SupabaseClient,
  weekId: string
): Promise<WeekItem[]> {
  const { data, error } = await supabase
    .from('eden_week_items')
    .select('*')
    .eq('week_id', weekId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to get week items:', error)
    return []
  }

  return (data || []) as WeekItem[]
}

/**
 * Get current week items for a user (across all active protocols)
 */
export async function getCurrentWeekItemsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<WeekItem & { protocol_id: string; domain: string }>> {
  const today = new Date().toISOString().slice(0, 10)

  // Get active weeks for user
  const { data: weeks, error: weeksError } = await supabase
    .from('eden_protocol_weeks')
    .select(`
      id,
      protocol_id,
      eden_protocols!inner (
        eden_goals!inner (
          domain
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('week_start', today)

  if (weeksError || !weeks) {
    console.error('Failed to get user weeks:', weeksError)
    return []
  }

  // Get items for all active weeks
  const weekIds = weeks.map(w => w.id)
  if (weekIds.length === 0) return []

  const { data: items, error: itemsError } = await supabase
    .from('eden_week_items')
    .select('*')
    .in('week_id', weekIds)

  if (itemsError) {
    console.error('Failed to get week items:', itemsError)
    return []
  }

  // Enrich items with protocol and domain info
  return (items || []).map(item => {
    const week = weeks.find(w => w.id === item.week_id)
    const protocol = week?.eden_protocols as { eden_goals: { domain: string } } | undefined
    return {
      ...item,
      protocol_id: week?.protocol_id || '',
      domain: protocol?.eden_goals?.domain || '',
    }
  }) as Array<WeekItem & { protocol_id: string; domain: string }>
}

// ============================================================================
// Week Item Updates
// ============================================================================

/**
 * Record a completion event for a week item
 */
export async function recordCompletion(
  supabase: SupabaseClient,
  itemId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  // Get current item state
  const { data: item, error: fetchError } = await supabase
    .from('eden_week_items')
    .select('target_count, completed_count, completion_events')
    .eq('id', itemId)
    .single()

  if (fetchError || !item) {
    return { success: false, error: 'Item not found' }
  }

  // Check if already at target
  if (item.completed_count >= item.target_count) {
    return { success: false, error: 'Already completed maximum times' }
  }

  // Add completion event
  const events = (item.completion_events as CompletionEvent[]) || []
  const newEvent: CompletionEvent = {
    at: new Date().toISOString(),
    ...(notes && { notes }),
  }

  const { error: updateError } = await supabase
    .from('eden_week_items')
    .update({
      completed_count: item.completed_count + 1,
      completion_events: [...events, newEvent],
    })
    .eq('id', itemId)

  if (updateError) {
    return { success: false, error: 'Failed to update item' }
  }

  return { success: true }
}

/**
 * Remove the last completion event (undo)
 */
export async function undoCompletion(
  supabase: SupabaseClient,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  // Get current item state
  const { data: item, error: fetchError } = await supabase
    .from('eden_week_items')
    .select('completed_count, completion_events')
    .eq('id', itemId)
    .single()

  if (fetchError || !item) {
    return { success: false, error: 'Item not found' }
  }

  if (item.completed_count === 0) {
    return { success: false, error: 'Nothing to undo' }
  }

  // Remove last event
  const events = (item.completion_events as CompletionEvent[]) || []
  events.pop()

  const { error: updateError } = await supabase
    .from('eden_week_items')
    .update({
      completed_count: item.completed_count - 1,
      completion_events: events,
    })
    .eq('id', itemId)

  if (updateError) {
    return { success: false, error: 'Failed to update item' }
  }

  return { success: true }
}

/**
 * Skip a week item with reason
 */
export async function skipItem(
  supabase: SupabaseClient,
  itemId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('eden_week_items')
    .update({
      skipped_at: new Date().toISOString(),
      skip_reason: reason,
    })
    .eq('id', itemId)

  if (error) {
    return { success: false, error: 'Failed to skip item' }
  }

  return { success: true }
}

// ============================================================================
// Week Completion
// ============================================================================

/**
 * Complete a week (mark as completed, calculate adherence)
 */
export async function completeWeek(
  supabase: SupabaseClient,
  weekId: string
): Promise<{ success: boolean; adherence?: number; error?: string }> {
  // Get all items for the week
  const items = await getWeekItems(supabase, weekId)

  if (items.length === 0) {
    return { success: false, error: 'No items found for week' }
  }

  // Calculate adherence
  const totalTarget = items.reduce((sum, item) => sum + item.target_count, 0)
  const totalCompleted = items.reduce((sum, item) => sum + item.completed_count, 0)
  const adherence = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0

  // Update week status
  const { error } = await supabase
    .from('eden_protocol_weeks')
    .update({ status: 'completed' })
    .eq('id', weekId)

  if (error) {
    return { success: false, error: 'Failed to complete week' }
  }

  return { success: true, adherence: Math.round(adherence) }
}

/**
 * Get adherence stats for a week
 */
export async function getWeekAdherence(
  supabase: SupabaseClient,
  weekId: string
): Promise<{
  totalTarget: number
  totalCompleted: number
  adherencePercent: number
  itemStats: Array<{
    title: string
    target: number
    completed: number
    percent: number
  }>
}> {
  const items = await getWeekItems(supabase, weekId)

  const totalTarget = items.reduce((sum, item) => sum + item.target_count, 0)
  const totalCompleted = items.reduce((sum, item) => sum + item.completed_count, 0)

  return {
    totalTarget,
    totalCompleted,
    adherencePercent: totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0,
    itemStats: items.map(item => ({
      title: item.title,
      target: item.target_count,
      completed: item.completed_count,
      percent: item.target_count > 0 ? Math.round((item.completed_count / item.target_count) * 100) : 0,
    })),
  }
}

// ============================================================================
// Auto Week Creation
// ============================================================================

/**
 * Ensure current week exists for a protocol
 * Creates one if it doesn't exist
 */
export async function ensureCurrentWeek(
  supabase: SupabaseClient,
  userId: string,
  protocolId: string,
  protocolVersion: number,
  scorecardSnapshot?: PrimeScorecard
): Promise<CreateWeekInstanceResult> {
  // Get week start (Monday of current week)
  const weekStart = getWeekStart(new Date())

  // Check if week exists
  const currentWeek = await getCurrentWeek(supabase, protocolId)
  
  if (currentWeek) {
    const currentWeekStart = new Date(currentWeek.week_start)
    if (currentWeekStart.getTime() === weekStart.getTime()) {
      // Week already exists
      const items = await getWeekItems(supabase, currentWeek.id)
      return {
        success: true,
        weekId: currentWeek.id,
        week: currentWeek,
        items,
      }
    }
  }

  // Create new week
  return createWeekInstance(supabase, {
    userId,
    protocolId,
    protocolVersion,
    weekStart,
    scorecardSnapshot,
  })
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse cadence string to target count
 */
function parseTargetCount(cadence: string | null): number {
  if (!cadence) return 1

  const lower = cadence.toLowerCase()
  if (lower === 'daily') return 7
  if (lower.includes('6x')) return 6
  if (lower.includes('5x')) return 5
  if (lower.includes('4x')) return 4
  if (lower.includes('3x')) return 3
  if (lower.includes('2x')) return 2
  if (lower === 'weekly' || lower === 'once') return 1

  // Try to extract number
  const match = lower.match(/(\d+)/)
  if (match) return parseInt(match[1], 10)

  return 1
}

/**
 * Get the Monday of the week containing the given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

