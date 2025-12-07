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
    <main className="h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Navigation */}
      <header className="flex-shrink-0 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-semibold">Eden</Link>
            <nav className="flex gap-6">
              <Link href="/dashboard" className="text-sm text-white/50 hover:text-white">Dashboard</Link>
              <Link href="/chat" className="text-sm text-white">Chat</Link>
              <Link href="/data" className="text-sm text-white/50 hover:text-white">Data</Link>
            </nav>
          </div>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      {/* Focus banner */}
      {activePlan && (
        <div className="flex-shrink-0 border-b border-white/10 bg-[#141414]">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <p className="text-xs text-[#c8ff00] uppercase tracking-wide mb-1">This week&apos;s focus</p>
            <p className="text-sm text-white/80">{activePlan.focus_summary}</p>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto h-full">
          <EdenCoachChat />
        </div>
      </div>
    </main>
  )
}
