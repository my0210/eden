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
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto h-screen max-w-md sm:max-w-lg flex flex-col px-3 py-4">

        {/* Header */}
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
              E
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-50">Eden Coach</p>
              <p className="text-[11px] text-slate-400">
                Stay in your prime.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Online</span>
            </div>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-800 transition"
            >
              View card
            </Link>
          </div>
        </header>

        {/* This week with Eden strip */}
        <section className="mb-3 rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-2">
          {activePlan ? (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                This week with Eden
              </p>
              <p className="text-xs text-slate-100">
                {activePlan.focus_summary}
              </p>
              <p className="text-[10px] text-slate-500">
                {activePlan.start_date} – {activePlan.end_date}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Getting to know you
              </p>
              <p className="text-xs text-slate-100">
                I&apos;ll use this chat to learn about your goals and routines, then I&apos;ll suggest a clear focus for your first week.
              </p>
            </div>
          )}
        </section>

        {/* Main chat area */}
        <section className="flex-1 min-h-0 rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            <EdenCoachChat />
          </div>
        </section>

      </div>
    </main>
  )
}

