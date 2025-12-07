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
      
      {/* Top bar */}
      <header className="flex items-center justify-center px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-xs font-bold text-white">E</span>
          </div>
          <span className="font-semibold text-gray-900">Eden</span>
        </div>
      </header>

      {/* Focus banner */}
      {activePlan && (
        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-0.5">This week&apos;s focus</p>
          <p className="text-sm text-emerald-900">{activePlan.focus_summary}</p>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <EdenCoachChat />
      </div>

      {/* Bottom navigation */}
      <nav className="flex border-t border-gray-100 bg-white">
        <Link href="/chat" className="flex-1 flex flex-col items-center py-3 text-emerald-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-medium mt-1">Chat</span>
        </Link>
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-gray-400 hover:text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-medium mt-1">Dashboard</span>
        </Link>
      </nav>
    </main>
  )
}
