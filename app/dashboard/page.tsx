import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot } from '@/lib/context/getUserSnapshot'
import AppleHealthUpload from './AppleHealthUpload'

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  let snapshot = null
  try {
    snapshot = await getUserSnapshot(supabase, user.id)
  } catch (e) {
    console.error('Failed to build snapshot', e)
  }

  // Compute a simple overall score
  let overallScore = 0
  let metricsCount = 0
  if (snapshot?.metrics) {
    for (const m of snapshot.metrics) {
      if (m.latestValue !== null) {
        // Simplified scoring
        metricsCount++
        if (m.metricCode === 'vo2max') overallScore += Math.min(100, (m.latestValue / 50) * 100)
        else if (m.metricCode?.includes('hr')) overallScore += Math.max(0, 100 - (m.latestValue - 50))
        else overallScore += 70
      }
    }
  }
  const edenScore = metricsCount > 0 ? Math.round(overallScore / metricsCount) : null

  return (
    <main className="min-h-screen bg-[#f8f7f4]">
      <div className="mx-auto max-w-3xl px-4 py-6">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <span className="text-lg font-semibold text-stone-900">Eden</span>
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </Link>
        </header>

        {/* Score Cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {/* Eden Score */}
          <div className="rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-rose-500 p-5 text-white">
            <p className="text-sm font-medium text-white/80 mb-3">Eden Score</p>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold">{edenScore ?? '—'}</span>
              {edenScore && <span className="text-lg text-white/70 mb-1">/ 100</span>}
            </div>
            <p className="mt-3 text-sm text-white/80">
              {edenScore ? (edenScore >= 70 ? "You're doing great. Keep it up!" : "Room to improve. Let's work on it.") : 'Add data to see your score'}
            </p>
          </div>

          {/* Quick Status */}
          <div className="rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 p-5 text-white">
            <p className="text-sm font-medium text-white/80 mb-3">Status</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Metrics tracked</span>
                <span className="font-semibold">{metricsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Data sources</span>
                <span className="font-semibold">1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last updated</span>
                <span className="font-semibold">Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics breakdown */}
        {snapshot?.metrics && snapshot.metrics.length > 0 && (
          <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="font-semibold text-stone-900">Your Metrics</h2>
            </div>
            <div className="divide-y divide-stone-100">
              {snapshot.metrics.slice(0, 6).map((metric) => (
                <div key={metric.metricCode} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{metric.metricName || metric.metricCode}</p>
                    <p className="text-xs text-stone-500">{metric.categoryCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-stone-900">
                      {metric.latestValue !== null ? metric.latestValue : '—'}
                    </p>
                    <p className="text-xs text-emerald-600 font-medium">
                      {metric.latestValue !== null ? '● Tracked' : '○ No data'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Sources */}
        <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-900">Data Sources</h2>
          </div>
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-red-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-stone-900">Apple Health</p>
                <p className="text-sm text-stone-500 mt-0.5">Upload your health export</p>
                <div className="mt-3">
                  <AppleHealthUpload userId={user.id} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-[11px] text-stone-400 text-center">
          Eden is not a medical service. Consult a qualified professional for health concerns.
        </p>

      </div>
    </main>
  )
}
