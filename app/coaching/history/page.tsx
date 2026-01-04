import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ProfileMenu from '../../dashboard/ProfileMenu'
import ChangeHistory from '../ChangeHistory'

export default async function HistoryPage() {
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

  // Get all decisions for this goal
  let decisions: Array<{
    id: string
    protocol_id: string
    trigger_type: string
    trigger_context: Record<string, unknown> | null
    reason: string
    changes_made: Record<string, unknown> | null
    expected_outcome: string | null
    reevaluate_at: string | null
    outcome_notes: string | null
    outcome_status: string | null
    created_at: string
    protocol_version: number
  }> = []

  if (activeGoal) {
    // Get protocols for this goal
    const { data: protocols } = await supabase
      .from('eden_protocols')
      .select('id, version')
      .eq('goal_id', activeGoal.id)

    if (protocols && protocols.length > 0) {
      const protocolIds = protocols.map(p => p.id)
      const versionMap = new Map(protocols.map(p => [p.id, p.version]))

      const { data: decisionsData } = await supabase
        .from('eden_protocol_decisions')
        .select('*')
        .in('protocol_id', protocolIds)
        .order('created_at', { ascending: false })

      decisions = (decisionsData || []).map(d => ({
        ...d,
        protocol_version: versionMap.get(d.protocol_id) || 1,
      }))
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
        {/* Back link */}
        <Link 
          href="/coaching" 
          className="inline-flex items-center gap-2 text-[15px] text-[#007AFF] hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Coaching
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h1 className="text-[22px] font-semibold text-black mb-1">Change History</h1>
          <p className="text-[15px] text-[#8E8E93]">
            See why your plan has changed and whether those changes worked.
          </p>
        </div>

        {/* Change history */}
        <ChangeHistory decisions={decisions} />

        <p className="text-[11px] text-[#8E8E93] text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}

