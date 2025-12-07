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
    <main className="min-h-screen bg-[#faf9f7]">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+CjxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgZmlsbD0iI2ZhZjlmNyI+PC9yZWN0Pgo8Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxIiBmaWxsPSIjZThlN2U1IiBmaWxsLW9wYWNpdHk9IjAuMyI+PC9jaXJjbGU+Cjwvc3ZnPg==')] opacity-50 pointer-events-none" />
      
      <div className="relative mx-auto max-w-4xl px-5 py-8 lg:py-12">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-xl font-bold text-white">E</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">My Eden</h1>
              <p className="text-sm text-stone-500">Your health, simplified.</p>
            </div>
          </div>
          
          <Link
            href="/chat"
            className="group flex items-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-stone-900/10 transition-all hover:shadow-xl hover:shadow-stone-900/20"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Talk to Eden
            <svg className="w-4 h-4 opacity-50 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </header>

        {/* Eden Card */}
        <section className="mb-10">
          <EdenCard snapshot={snapshot} hasProfile={hasProfile} />
        </section>

        {/* Data Sources */}
        <section>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-stone-900">Data sources</h2>
            <p className="text-sm text-stone-500">Connect your data for better insights.</p>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Apple Health */}
            <div className="rounded-3xl bg-white border border-stone-200/80 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-red-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-stone-900">Apple Health</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    Activity, heart rate, sleep, and more from your iPhone.
                  </p>
                </div>
              </div>
              <AppleHealthUpload userId={user.id} />
            </div>

            {/* Labs & Wearables */}
            <div className="rounded-3xl bg-stone-50 border border-dashed border-stone-300 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-stone-200 flex items-center justify-center">
                  <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-stone-600">Labs &amp; wearables</h3>
                  <p className="text-sm text-stone-400 mt-1">
                    More integrations coming soon.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-stone-200">
          <p className="text-xs text-stone-400 text-center">
            Eden is not a medical service and does not provide diagnosis or treatment.
            <br className="hidden sm:block" />
            Always consult a qualified professional for health concerns.
          </p>
        </footer>
      </div>
    </main>
  )
}
