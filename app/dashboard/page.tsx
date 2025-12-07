import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot } from '@/lib/context/getUserSnapshot'
import AppleHealthUpload from './AppleHealthUpload'
import EdenCard from './EdenCard'

export default async function DashboardPage() {
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
    console.error('Failed to build snapshot', e)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 lg:py-10 space-y-8">

        {/* Header with navigation */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
              Eden dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your Eden card and data sources.
            </p>
          </div>
          <Link
            href="/chat"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
          >
            Chat with Eden
          </Link>
        </header>

        {/* Eden Card */}
        <section>
          <EdenCard snapshot={snapshot} hasProfile={hasProfile} />
        </section>

        {/* Data sources */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Data sources</h2>
            <p className="text-xs text-slate-500">These feeds help Eden understand your health over time.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Apple Health tile */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">📱</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Apple Health</p>
                  <p className="text-xs text-slate-500">
                    Upload an Apple Health export so Eden can use your real-world activity, heart rate, and sleep.
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <AppleHealthUpload userId={user.id} />
              </div>
            </div>

            {/* Placeholder for future sources */}
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 flex flex-col justify-center">
              <p className="text-sm font-medium text-slate-900">Labs &amp; wearables</p>
              <p className="mt-1 text-xs text-slate-500">
                Additional sources will appear here as they are connected.
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  )
}
