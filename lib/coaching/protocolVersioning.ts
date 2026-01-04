/**
 * Protocol Versioning
 * 
 * Manages protocol versions, diffing, and version chain operations.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  Protocol,
  ProtocolChanges,
  ProtocolAction,
  Milestone,
  ActionInput,
} from './types'

export interface VersionChainEntry {
  version: number
  protocol_id: string
  created_at: string
  changes_summary: string | null
  trigger_type: string | null
}

/**
 * Get the version chain for a goal (all protocol versions)
 */
export async function getVersionChain(
  supabase: SupabaseClient,
  goalId: string
): Promise<VersionChainEntry[]> {
  const { data: protocols, error } = await supabase
    .from('eden_protocols')
    .select(`
      id,
      version,
      created_at,
      changes_from_parent,
      eden_protocol_decisions (
        trigger_type
      )
    `)
    .eq('goal_id', goalId)
    .order('version', { ascending: true })

  if (error) {
    console.error('Failed to get version chain:', error)
    return []
  }

  return (protocols || []).map(p => ({
    version: p.version,
    protocol_id: p.id,
    created_at: p.created_at,
    changes_summary: p.changes_from_parent?.summary || null,
    trigger_type: p.eden_protocol_decisions?.[0]?.trigger_type || null,
  }))
}

/**
 * Create a new protocol version
 */
export async function createNewVersion(
  supabase: SupabaseClient,
  currentProtocol: Protocol,
  newData: {
    focus_summary?: string
    actions: ActionInput[]
    milestones?: {
      phase_number: number
      new_target_date?: string
      new_criteria?: string
    }[]
  },
  changes: ProtocolChanges,
  llmRaw: Record<string, unknown>
): Promise<{ success: boolean; newProtocol?: Protocol; error?: string }> {
  try {
    // 1) Mark current protocol as superseded
    const { error: updateError } = await supabase
      .from('eden_protocols')
      .update({
        status: 'superseded',
        effective_until: new Date().toISOString(),
      })
      .eq('id', currentProtocol.id)

    if (updateError) {
      throw new Error(`Failed to supersede current protocol: ${updateError.message}`)
    }

    // 2) Create new protocol version
    const { data: newProtocol, error: insertError } = await supabase
      .from('eden_protocols')
      .insert({
        goal_id: currentProtocol.goal_id,
        version: currentProtocol.version + 1,
        parent_version_id: currentProtocol.id,
        focus_summary: newData.focus_summary || currentProtocol.focus_summary,
        total_phases: currentProtocol.total_phases,
        current_phase: currentProtocol.current_phase,
        status: 'active',
        effective_from: new Date().toISOString(),
        llm_raw: llmRaw,
        changes_from_parent: changes,
      })
      .select()
      .single()

    if (insertError || !newProtocol) {
      throw new Error(`Failed to create new protocol version: ${insertError?.message}`)
    }

    // 3) Copy milestones with any adjustments
    const { data: existingMilestones } = await supabase
      .from('eden_milestones')
      .select('*')
      .eq('protocol_id', currentProtocol.id)

    if (existingMilestones && existingMilestones.length > 0) {
      const adjustments = new Map(
        (newData.milestones || []).map(m => [m.phase_number, m])
      )

      const newMilestones = existingMilestones.map(m => {
        const adj = adjustments.get(m.phase_number)
        return {
          protocol_id: newProtocol.id,
          phase_number: m.phase_number,
          title: m.title,
          description: m.description,
          success_criteria: adj?.new_criteria || m.success_criteria,
          target_date: adj?.new_target_date || m.target_date,
          status: m.status,
        }
      })

      await supabase.from('eden_milestones').insert(newMilestones)
    }

    // 4) Create new actions
    if (newData.actions.length > 0) {
      const actionsData = newData.actions.map((a, i) => ({
        protocol_id: newProtocol.id,
        priority: a.priority || i + 1,
        title: a.title,
        description: a.description || null,
        metric_code: a.metric_code || null,
        target_value: a.target_value || null,
        cadence: a.cadence || null,
        week_number: a.week_number || null,
      }))

      await supabase.from('eden_protocol_actions').insert(actionsData)
    }

    return { success: true, newProtocol: newProtocol as Protocol }
  } catch (error) {
    console.error('Failed to create new version:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Calculate diff between two sets of actions
 */
export function calculateChanges(
  oldActions: ProtocolAction[],
  newActions: ActionInput[]
): ProtocolChanges {
  const changes: ProtocolChanges = {}

  // Action changes
  const oldActionTitles = new Set(oldActions.map(a => a.title.toLowerCase()))
  const newActionTitles = new Set(newActions.map(a => a.title.toLowerCase()))

  const addedActions = newActions
    .filter(a => !oldActionTitles.has(a.title.toLowerCase()))
    .map(a => a.title)
  
  const removedActions = oldActions
    .filter(a => !newActionTitles.has(a.title.toLowerCase()))
    .map(a => a.title)

  if (addedActions.length > 0 || removedActions.length > 0) {
    changes.actions = {}
    if (addedActions.length > 0) changes.actions.added = addedActions
    if (removedActions.length > 0) changes.actions.removed = removedActions
  }

  // Generate summary
  const summaryParts: string[] = []
  if (changes.actions?.added?.length) {
    summaryParts.push(`Added ${changes.actions.added.length} action(s)`)
  }
  if (changes.actions?.removed?.length) {
    summaryParts.push(`Removed ${changes.actions.removed.length} action(s)`)
  }

  if (summaryParts.length > 0) {
    changes.summary = summaryParts.join(', ')
  }

  return changes
}

/**
 * Get protocol with all related data
 */
export async function getProtocolWithDetails(
  supabase: SupabaseClient,
  protocolId: string
): Promise<{
  protocol: Protocol | null
  milestones: Milestone[]
  actions: ProtocolAction[]
}> {
  const { data: protocol } = await supabase
    .from('eden_protocols')
    .select('*')
    .eq('id', protocolId)
    .single()

  const { data: milestones } = await supabase
    .from('eden_milestones')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('phase_number', { ascending: true })

  const { data: actions } = await supabase
    .from('eden_protocol_actions')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('priority', { ascending: true })

  return {
    protocol: protocol as Protocol | null,
    milestones: (milestones || []) as Milestone[],
    actions: (actions || []) as ProtocolAction[],
  }
}
