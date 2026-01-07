import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ProfileMenu from '../dashboard/ProfileMenu'
import DomainProtocolCards, { DomainProtocol } from './DomainProtocolCards'
import WeekItemList, { WeekItem } from './WeekItemList'
import MilestoneTimeline from './MilestoneTimeline'

export default async function CoachingPage() {
  const { user } = await requireOnboardedUser()
  const supabase = await createClient()

  // Get active domain goals (goal_type = 'domain')
  const { data: domainGoals } = await supabase
    .from('eden_goals')
    .select(`
      id,
      goal_type,
      domain,
      priority,
      target_description,
      duration_weeks,
      started_at,
      status
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('goal_type', 'domain')
    .order('priority', { ascending: true })

  // Get protocols for active domain goals
  const domainProtocols: DomainProtocol[] = []
  let allWeekItems: (WeekItem & { domain: string })[] = []
  let milestones: Array<{
    id: string
    phase_number: number
    title: string
    description: string | null
    success_criteria: string | null
    target_date: string | null
    status: string
  }> = []

  if (domainGoals && domainGoals.length > 0) {
    for (const goal of domainGoals) {
      // Get active protocol for this goal
      const { data: protocol } = await supabase
        .from('eden_protocols')
        .select('*')
        .eq('goal_id', goal.id)
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (protocol) {
        // Get current week's adherence
        const today = new Date().toISOString().slice(0, 10)
        const { data: currentWeek } = await supabase
          .from('eden_protocol_weeks')
          .select('id')
          .eq('protocol_id', protocol.id)
          .eq('status', 'active')
          .lte('week_start', today)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle()

        let weekAdherence: number | null = null
        if (currentWeek) {
          const { data: weekItems } = await supabase
            .from('eden_week_items')
            .select('target_count, completed_count')
            .eq('week_id', currentWeek.id)

          if (weekItems && weekItems.length > 0) {
            const totalTarget = weekItems.reduce((sum, item) => sum + item.target_count, 0)
            const totalCompleted = weekItems.reduce((sum, item) => sum + item.completed_count, 0)
            weekAdherence = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : null
          }
        }

        // Get domain score from latest scorecard
        const { data: scorecard } = await supabase
          .from('eden_scorecards')
          .select('scorecard_json')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const domainScore = goal.domain && scorecard?.scorecard_json
          ? (scorecard.scorecard_json as { domain_scores?: Record<string, number> }).domain_scores?.[goal.domain] ?? null
          : null

        domainProtocols.push({
          id: protocol.id,
          goal_id: goal.id,
          domain: goal.domain as DomainProtocol['domain'],
          priority: goal.priority || 1,
          goal_type: goal.goal_type as 'domain' | 'outcome',
          target_description: goal.target_description,
          duration_weeks: goal.duration_weeks,
          started_at: goal.started_at,
          protocol_version: protocol.version,
          focus_summary: protocol.focus_summary,
          template_id: protocol.template_id,
          current_phase: protocol.current_phase,
          total_phases: protocol.total_phases,
          domain_score: domainScore,
          week_adherence: weekAdherence,
        })

        // Get milestones from primary protocol
        if (goal.priority === 1) {
          const { data: protocolMilestones } = await supabase
            .from('eden_milestones')
            .select('*')
            .eq('protocol_id', protocol.id)
            .order('phase_number', { ascending: true })

          milestones = protocolMilestones || []
        }
      }
    }

    // Get current week items for all protocols
    const protocolIds = domainProtocols.map(p => p.id)
    if (protocolIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      
      // Get active weeks
      const { data: activeWeeks } = await supabase
        .from('eden_protocol_weeks')
        .select('id, protocol_id')
        .in('protocol_id', protocolIds)
        .eq('status', 'active')
        .lte('week_start', today)

      if (activeWeeks && activeWeeks.length > 0) {
        const weekIds = activeWeeks.map(w => w.id)
        
        // Get week items
        const { data: items } = await supabase
          .from('eden_week_items')
          .select('*')
          .in('week_id', weekIds)
          .order('created_at', { ascending: true })

        if (items) {
          // Enrich items with domain info
          allWeekItems = items.map(item => {
            const week = activeWeeks.find(w => w.id === item.week_id)
            const protocol = domainProtocols.find(p => p.id === week?.protocol_id)
            return {
              ...item,
              completion_events: (item.completion_events || []) as WeekItem['completion_events'],
              domain: protocol?.domain || '',
            }
          })
        }
      }
    }
  }

  // Fallback: Check for legacy outcome goals if no domain protocols
  let hasLegacyGoal = false
  let legacyGoal = null
  let legacyProtocol = null
  let legacyActions: Array<{
    id: string
    title: string
    description: string | null
    cadence: string | null
    completed_at: string | null
    priority: number
  }> = []

  if (domainProtocols.length === 0) {
    const { data: outcomeGoal } = await supabase
      .from('eden_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .neq('goal_type', 'domain')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (outcomeGoal) {
      hasLegacyGoal = true
      legacyGoal = outcomeGoal

      const { data: protocol } = await supabase
        .from('eden_protocols')
        .select('*')
        .eq('goal_id', outcomeGoal.id)
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      legacyProtocol = protocol

      if (protocol) {
        const { data: protocolMilestones } = await supabase
          .from('eden_milestones')
          .select('*')
          .eq('protocol_id', protocol.id)
          .order('phase_number', { ascending: true })

        milestones = protocolMilestones || []

        const { data: actionsData } = await supabase
          .from('eden_protocol_actions')
          .select('*')
          .eq('protocol_id', protocol.id)
          .order('priority', { ascending: true })

        legacyActions = actionsData || []
      }
    }
  }

  const hasDomainProtocols = domainProtocols.length > 0
  const hasAnyProtocol = hasDomainProtocols || hasLegacyGoal

  return (
    <main className="min-h-screen bg-[#F2F2F7]">
      {/* Navigation */}
      <header className="bg-[#F2F2F7]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/chat" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Eden</Link>
            <Link href="/dashboard" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Dashboard</Link>
            <Link href="/coaching" className="text-[17px] font-semibold text-[#007AFF]">Coaching</Link>
            <Link href="/data" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Data</Link>
          </nav>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!hasAnyProtocol ? (
          // No active protocols - show empty state
          <DomainProtocolCards protocols={[]} />
        ) : hasDomainProtocols ? (
          // Domain-centered coaching view
          <>
            {/* Domain Protocol Cards */}
            <DomainProtocolCards protocols={domainProtocols} />

            {/* Milestone Timeline (from primary protocol) */}
            {milestones.length > 0 && (
              <MilestoneTimeline milestones={milestones} />
            )}

            {/* Week Items */}
            {allWeekItems.length > 0 ? (
              <WeekItemList items={allWeekItems} groupByDomain={true} />
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <p className="text-[15px] text-[#8E8E93]">
                  Your weekly items will appear here once your protocols are set up.
                </p>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 text-[15px] text-[#007AFF] mt-3 hover:underline"
                >
                  Chat with Eden to get started
                </Link>
              </div>
            )}
          </>
        ) : (
          // Legacy outcome goal view (backwards compatibility)
          <>
            {/* Goal Header */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">Active Goal</p>
                  <h1 className="text-[22px] font-semibold text-black mb-1">
                    {legacyGoal?.target_description}
                  </h1>
                  <p className="text-[15px] text-[#8E8E93]">
                    {legacyGoal?.duration_weeks} weeks • Started {legacyGoal?.started_at ? new Date(legacyGoal.started_at).toLocaleDateString() : 'Not started'}
                  </p>
                </div>
                {legacyProtocol && (
                  <Link
                    href="/coaching/history"
                    className="text-[13px] text-[#007AFF] hover:underline"
                  >
                    v{legacyProtocol.version} • View history
                  </Link>
                )}
              </div>
              {legacyProtocol?.focus_summary && (
                <p className="text-[15px] text-black/80 mt-4 pt-4 border-t border-[#E5E5EA]">
                  {legacyProtocol.focus_summary}
                </p>
              )}
            </div>

            {/* Milestone Timeline */}
            {milestones.length > 0 && (
              <MilestoneTimeline milestones={milestones} />
            )}

            {/* Legacy Actions */}
            {legacyActions.length > 0 && (
              <LegacyActionList actions={legacyActions} />
            )}
          </>
        )}

        <p className="text-[11px] text-[#8E8E93] text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}

// Legacy action list component (for backwards compatibility with old goal system)
function LegacyActionList({ actions }: { actions: Array<{ id: string; title: string; description: string | null; cadence: string | null; completed_at: string | null; priority: number }> }) {
  const completedCount = actions.filter(a => a.completed_at).length

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-semibold text-black">This Week&apos;s Actions</h2>
        <span className="text-[13px] text-[#8E8E93]">
          {completedCount}/{actions.length} done
        </span>
      </div>
      
      <div className="space-y-3">
        {actions.map((action) => {
          const isCompleted = !!action.completed_at
          
          return (
            <div
              key={action.id}
              className={`rounded-xl border p-4 ${
                isCompleted 
                  ? 'bg-[#F2F2F7] border-[#E5E5EA]' 
                  : 'bg-white border-[#E5E5EA]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div 
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isCompleted 
                      ? 'bg-[#34C759] border-[#34C759]' 
                      : 'border-[#C7C7CC]'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                
                <div className="flex-1">
                  <p className={`text-[15px] font-medium ${
                    isCompleted ? 'text-[#8E8E93] line-through' : 'text-black'
                  }`}>
                    {action.title}
                  </p>
                  
                  {action.cadence && (
                    <span className={`inline-block text-[11px] mt-1 px-2 py-0.5 rounded-full ${
                      isCompleted 
                        ? 'bg-[#E5E5EA] text-[#8E8E93]' 
                        : 'bg-[#007AFF]/10 text-[#007AFF]'
                    }`}>
                      {action.cadence}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      <p className="text-[11px] text-[#8E8E93] mt-4 text-center">
        This is a legacy goal. Consider upgrading to domain protocols for better tracking.
      </p>
    </div>
  )
}
