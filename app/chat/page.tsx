import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot } from '@/lib/context/getUserSnapshot'
import EdenCoachChat from '../dashboard/EdenCoachChat'

export default async function ChatPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch user profile to check if onboarding is complete
  const { data: profile } = await supabase
    .from('eden_user_profile')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const hasProfile = !!profile

  // Build the user snapshot
  let snapshot = null
  try {
    snapshot = await getUserSnapshot(supabase, user.id)
  } catch (e) {
    console.error('Failed to build snapshot for chat page', e)
  }

  // Fetch latest active plan for this user
  const today = new Date().toISOString().slice(0, 10)

  const { data: activePlans } = await supabase
    .from('eden_plans')
    .select('id, start_date, end_date, status, focus_summary')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: false })
    .limit(1)

  const activePlan = activePlans?.[0] ?? null

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/20 via-transparent to-stone-950/30 pointer-events-none" />
      
      <div className="relative mx-auto h-screen max-w-xl flex flex-col">
        
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-lg font-bold text-white">E</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0a]" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Eden</h1>
              <p className="text-xs text-white/40">Your primespan coach</p>
            </div>
          </div>
          
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            My Eden
          </Link>
        </header>

        {/* Focus strip */}
        <div className="px-5 py-3">
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 backdrop-blur-sm">
            {activePlan ? (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-400/80 mb-1">
                    This week&apos;s focus
                  </p>
                  <p className="text-sm text-white/90 leading-relaxed">
                    {activePlan.focus_summary}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/40 mb-1">
                    Getting started
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Tell me about your goals and I&apos;ll help you build a weekly focus.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 min-h-0 px-5 pb-4">
          <div className="h-full rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <EdenCoachChat />
          </div>
        </div>

        {/* Footer disclaimer */}
        <div className="px-5 pb-4">
          <p className="text-[10px] text-white/20 text-center">
            Eden is not a medical service. Always consult a professional for health concerns.
          </p>
        </div>
      </div>
    </main>
  )
}
