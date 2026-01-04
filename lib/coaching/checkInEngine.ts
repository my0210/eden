/**
 * Check-in Engine
 * 
 * Determines when and what to check in about.
 * Generates check-in content and handles check-in creation.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { CHECKIN_PROMPT } from './prompts'
import { Checkin, CheckinType, CheckinSummary, Protocol, Habit } from './types'

// Lazy initialization
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

export interface CheckInContext {
  protocol: Protocol
  actionsCompleted: number
  actionsTotal: number
  habitsLogged: number
  habitsTarget: number
  currentWeek: number
  recentMessages?: string[]
}

/**
 * Determine if a check-in should happen
 */
export async function shouldTriggerCheckIn(
  supabase: SupabaseClient,
  protocolId: string
): Promise<{ should: boolean; type: CheckinType | null; reason: string }> {
  // Get protocol
  const { data: protocol } = await supabase
    .from('eden_protocols')
    .select('*')
    .eq('id', protocolId)
    .single()

  if (!protocol) {
    return { should: false, type: null, reason: 'Protocol not found' }
  }

  const startDate = new Date(protocol.effective_from)
  const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000))
  const currentWeek = Math.ceil(daysSinceStart / 7)

  // Check for weekly review (every 7 days)
  const dayOfWeek = new Date().getDay()
  if (dayOfWeek === 0) { // Sunday
    // Check if we already did a weekly review this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    
    const { count } = await supabase
      .from('eden_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('protocol_id', protocolId)
      .eq('checkin_type', 'weekly_review')
      .gte('created_at', weekStart.toISOString())

    if ((count ?? 0) === 0) {
      return { should: true, type: 'weekly_review', reason: 'Weekly review due' }
    }
  }

  // Check for milestone review
  const { data: currentMilestone } = await supabase
    .from('eden_milestones')
    .select('*')
    .eq('protocol_id', protocolId)
    .eq('status', 'current')
    .single()

  if (currentMilestone?.target_date) {
    const targetDate = new Date(currentMilestone.target_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    targetDate.setHours(0, 0, 0, 0)

    // If target date is today or past
    if (targetDate <= today) {
      // Check if we already did a milestone review for this milestone
      const { count } = await supabase
        .from('eden_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('milestone_id', currentMilestone.id)
        .eq('checkin_type', 'milestone_review')

      if ((count ?? 0) === 0) {
        return { should: true, type: 'milestone_review', reason: 'Milestone target date reached' }
      }
    }
  }

  // Check for daily nudge (if habits missed)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const { data: habits } = await supabase
    .from('eden_habits')
    .select('id')
    .eq('protocol_id', protocolId)
    .eq('is_active', true)

  if (habits && habits.length > 0) {
    const habitIds = habits.map(h => h.id)

    // Check yesterday's habit completion
    const { count: yesterdayLogs } = await supabase
      .from('eden_habit_logs')
      .select('id', { count: 'exact', head: true })
      .in('habit_id', habitIds)
      .eq('logged_date', yesterday)
      .eq('completed', true)

    // If less than half habits were logged yesterday
    if ((yesterdayLogs ?? 0) < habits.length / 2) {
      // Check if we already sent a nudge today
      const { count: todayNudges } = await supabase
        .from('eden_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('protocol_id', protocolId)
        .eq('checkin_type', 'daily_nudge')
        .gte('created_at', new Date(today).toISOString())

      if ((todayNudges ?? 0) === 0) {
        return { should: true, type: 'daily_nudge', reason: 'Habits missed yesterday' }
      }
    }
  }

  return { should: false, type: null, reason: 'No check-in needed' }
}

/**
 * Generate check-in message
 */
export async function generateCheckInMessage(
  context: CheckInContext
): Promise<string> {
  const contextSummary = `
Protocol: ${context.protocol.focus_summary || 'No summary'}
Week: ${context.currentWeek}
Actions completed: ${context.actionsCompleted}/${context.actionsTotal}
Habits logged: ${context.habitsLogged}/${context.habitsTarget}
${context.recentMessages?.length ? `\nRecent messages:\n${context.recentMessages.join('\n')}` : ''}
`.trim()

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: CHECKIN_PROMPT },
        { role: 'user', content: contextSummary },
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    return completion.choices[0]?.message?.content || "How's your progress going this week?"
  } catch (error) {
    console.error('Failed to generate check-in message:', error)
    return "How's your progress going this week?"
  }
}

/**
 * Create a check-in record
 */
export async function createCheckIn(
  supabase: SupabaseClient,
  data: {
    protocol_id: string
    checkin_type: CheckinType
    week_number?: number
    milestone_id?: string
    summary_json?: CheckinSummary
    coach_response?: string
  }
): Promise<{ success: boolean; checkin?: Checkin; error?: string }> {
  try {
    const { data: checkin, error } = await supabase
      .from('eden_checkins')
      .insert({
        protocol_id: data.protocol_id,
        checkin_type: data.checkin_type,
        week_number: data.week_number || null,
        milestone_id: data.milestone_id || null,
        summary_json: data.summary_json || null,
        coach_response: data.coach_response || null,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, checkin: checkin as Checkin }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get recent check-ins for a protocol
 */
export async function getRecentCheckIns(
  supabase: SupabaseClient,
  protocolId: string,
  limit: number = 5
): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from('eden_checkins')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to get check-ins:', error)
    return []
  }

  return (data || []) as Checkin[]
}

