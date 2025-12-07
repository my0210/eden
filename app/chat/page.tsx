import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import EdenCoachChat from '../dashboard/EdenCoachChat'
import ProfileMenu from '../dashboard/ProfileMenu'

export default async function ChatPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)
  const { data: activePlans } = await supabase
    .from('eden_plans')
    .select('id, focus_summary')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(1)

  const activePlan = activePlans?.[0] ?? null

  return (
    <main className="h-screen bg-[#F2F2F7] flex flex-col">
      {/* Navigation - Apple style */}
      <header className="flex-shrink-0 bg-[#F2F2F7]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/chat" className="text-[17px] font-semibold text-[#007AFF]">Eden</Link>
            <Link href="/dashboard" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Dashboard</Link>
            <Link href="/data" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Data</Link>
          </nav>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      {/* Focus banner */}
      {activePlan && (
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="bg-white rounded-xl shadow-sm px-4 py-3">
              <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">This week&apos;s focus</p>
              <p className="text-[15px] text-black">{activePlan.focus_summary}</p>
            </div>
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
