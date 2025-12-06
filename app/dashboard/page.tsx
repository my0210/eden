import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot } from '@/lib/context/getUserSnapshot'
import AppleHealthUpload from './AppleHealthUpload'
import EdenCoachChat from './EdenCoachChat'
import EdenCard from './EdenCard'

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()
  const displayName = user.email?.split('@')[0] || 'there'

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
    console.error('Failed to build snapshot', e)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10 space-y-8">

        {/* Hero Section */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                <span className="text-sm">🧬</span>
                <span>Primespan Coach</span>
              </div>
              <div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900">
                  Welcome, {displayName}
                </h1>
                <p className="mt-2 text-sm text-slate-600 max-w-xl">
                  Eden uses your metrics and profile to build this card and guide your training, recovery, and lifestyle decisions.
                </p>
              </div>
              {!hasProfile && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 max-w-md">
                  Eden only knows a little about you so far. Start the onboarding chat on WhatsApp to unlock a more personalised card.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Main area: Eden card + chat */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] items-start">
          <EdenCard snapshot={snapshot} hasProfile={hasProfile} />
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Chat with Eden</h2>
              <p className="text-sm text-slate-600">
                Use the coach to interpret your card and decide what to focus on next.
              </p>
            </div>
            <EdenCoachChat />
          </div>
        </section>

        {/* Data sources */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Data sources</h2>
            <p className="text-xs text-slate-500">More data → better coaching</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Apple Health tile */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">📱</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Apple Health</p>
                  <p className="text-xs text-slate-500">
                    Upload an export so Eden can use your real-world data.
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <AppleHealthUpload userId={user.id} />
              </div>
            </div>

            {/* Placeholder for future sources */}
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 flex flex-col justify-center">
              <p className="text-sm font-medium text-slate-900">Labs & wearables</p>
              <p className="mt-1 text-xs text-slate-500">
                Soon, you&apos;ll be able to connect labs and more devices. For now, Eden uses your basic profile and Apple Health.
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  )
}
