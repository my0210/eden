import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import EdenCoachChat from '../dashboard/EdenCoachChat'

export default async function ChatPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch latest active plan
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
    <main className="min-h-screen bg-white flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">E</span>
                </div>
                <span className="font-semibold text-gray-900">Eden</span>
              </div>
              <nav className="flex gap-1">
                <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-full">
                  Data
                </Link>
                <Link href="/chat" className="px-3 py-1.5 text-sm font-medium text-gray-900 bg-gray-100 rounded-full">
                  Chat
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Focus banner */}
      {activePlan && (
        <div className="border-b border-gray-100 bg-emerald-50">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-0.5">This week</p>
            <p className="text-sm text-emerald-900">{activePlan.focus_summary}</p>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-hidden max-w-2xl mx-auto w-full">
        <EdenCoachChat />
      </div>
    </main>
  )
}
