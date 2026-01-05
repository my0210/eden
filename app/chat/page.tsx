import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import EdenCoachChat from '../dashboard/EdenCoachChat'
import ProfileMenu from '../dashboard/ProfileMenu'

export default async function ChatPage() {
  const { user } = await requireOnboardedUser()
  const supabase = await createClient()


  // Get active goal (optional)
  const { data: activeGoals } = await supabase
    .from('eden_goals')
    .select(`
      id, 
      target_description,
      goal_type,
      domain,
      eden_protocols!inner (
        id,
        focus_summary,
        current_phase,
        total_phases,
        status
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('eden_protocols.status', 'active')
    .limit(1)

  const activeGoal = activeGoals?.[0] ?? null
  const activeProtocol = activeGoal?.eden_protocols?.[0] ?? null

  return (
    <main className="h-screen bg-[#F2F2F7] flex flex-col">
      {/* Navigation - Apple style */}
      <header className="flex-shrink-0 bg-[#F2F2F7]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/chat" className="text-[17px] font-semibold text-[#007AFF]">Eden</Link>
            <Link href="/dashboard" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Dashboard</Link>
            <Link href="/coaching" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Coaching</Link>
            <Link href="/data" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Data</Link>
          </nav>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      {/* Active goal quick link */}
      {activeGoal && (
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="flex items-center gap-3">
              <Link 
                href="/coaching"
                className="flex items-center gap-2 bg-[#FF9500]/10 px-3 py-1.5 rounded-full hover:bg-[#FF9500]/20 transition-colors"
              >
                <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-[13px] text-[#FF9500] font-medium">
                  View Plan
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Active goal banner (if exists) */}
      {activeGoal && activeProtocol && (
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto px-4 pb-2">
            <Link href="/coaching" className="block">
              <div className="bg-white rounded-xl shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">Active Goal</p>
                    <p className="text-[15px] text-black">{activeGoal.target_description}</p>
                    {activeProtocol.focus_summary && (
                      <p className="text-[13px] text-[#8E8E93] mt-1">{activeProtocol.focus_summary}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide">Phase</p>
                    <p className="text-[15px] text-[#007AFF] font-medium">
                      {activeProtocol.current_phase}/{activeProtocol.total_phases}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 min-h-0 max-w-3xl mx-auto w-full px-4 pb-4">
        <div className="h-full bg-white rounded-xl shadow-sm overflow-hidden">
          <EdenCoachChat />
        </div>
      </div>
    </main>
  )
}
