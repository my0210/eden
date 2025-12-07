import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot } from '@/lib/context/getUserSnapshot'
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
    <main className="min-h-screen bg-[#f8f7f4]">
      <div className="mx-auto max-w-2xl">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-stone-200/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <span className="text-lg font-semibold text-stone-900">Eden</span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-stone-500 hover:text-stone-900 transition"
          >
            Dashboard
          </Link>
        </header>

        {/* Focus card */}
        {activePlan && (
          <div className="px-4 pt-4">
            <div className="rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 p-4 text-white">
              <p className="text-xs font-medium uppercase tracking-wide text-white/70 mb-1">This week</p>
              <p className="text-sm font-medium leading-relaxed">{activePlan.focus_summary}</p>
            </div>
          </div>
        )}

        {/* Chat */}
        <div className="h-[calc(100vh-140px)]">
          <EdenCoachChat />
        </div>

      </div>
    </main>
  )
}
