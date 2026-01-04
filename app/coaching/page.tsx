import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ProfileMenu from '../dashboard/ProfileMenu'
import MilestoneTimeline from './MilestoneTimeline'
import WeeklyAdherence from './WeeklyAdherence'
import ActionList from './ActionList'

export default async function CoachingPage() {
  const { user } = await requireOnboardedUser()
  const supabase = await createClient()

  // Get active goal
  const { data: activeGoal } = await supabase
    .from('eden_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get active protocol if goal exists
  let activeProtocol = null
  let milestones: Array<{
    id: string
    phase_number: number
    title: string
    description: string | null
    success_criteria: string | null
    target_date: string | null
    status: string
  }> = []
  let actions: Array<{
    id: string
    title: string
    description: string | null
    cadence: string | null
    completed_at: string | null
    priority: number
  }> = []

  if (activeGoal) {
    const { data: protocol } = await supabase
      .from('eden_protocols')
      .select('*')
      .eq('goal_id', activeGoal.id)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    activeProtocol = protocol

    if (protocol) {
      // Get milestones
      const { data: milestonesData } = await supabase
        .from('eden_milestones')
        .select('*')
        .eq('protocol_id', protocol.id)
        .order('phase_number', { ascending: true })

      milestones = milestonesData || []

      // Get actions
      const { data: actionsData } = await supabase
        .from('eden_protocol_actions')
        .select('*')
        .eq('protocol_id', protocol.id)
        .order('priority', { ascending: true })

      actions = actionsData || []
    }
  }

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
        {!activeGoal ? (
          // No active goal - prompt to start
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-[#FF9500]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-[22px] font-semibold text-black mb-2">No Active Goal</h2>
            <p className="text-[15px] text-[#8E8E93] mb-6 max-w-sm mx-auto">
              Chat with Eden to set a health goal and get a personalized coaching plan.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-[#007AFF] text-white px-6 py-3 rounded-full text-[17px] font-medium hover:bg-[#0066CC] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Start with Eden
            </Link>
          </div>
        ) : (
          <>
            {/* Goal Header */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">Active Goal</p>
                  <h1 className="text-[22px] font-semibold text-black mb-1">
                    {activeGoal.target_description}
                  </h1>
                  <p className="text-[15px] text-[#8E8E93]">
                    {activeGoal.duration_weeks} weeks • Started {activeGoal.started_at ? new Date(activeGoal.started_at).toLocaleDateString() : 'Not started'}
                  </p>
                </div>
                {activeProtocol && (
                  <Link
                    href="/coaching/history"
                    className="text-[13px] text-[#007AFF] hover:underline"
                  >
                    v{activeProtocol.version} • View history
                  </Link>
                )}
              </div>
              {activeProtocol?.focus_summary && (
                <p className="text-[15px] text-black/80 mt-4 pt-4 border-t border-[#E5E5EA]">
                  {activeProtocol.focus_summary}
                </p>
              )}
            </div>

            {/* Milestone Timeline */}
            <MilestoneTimeline milestones={milestones} />

            {/* Weekly Adherence */}
            <WeeklyAdherence
              protocolId={activeProtocol?.id || ''}
              actions={actions}
            />

            {/* Actions */}
            <ActionList actions={actions} />
          </>
        )}

        <p className="text-[11px] text-[#8E8E93] text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}
