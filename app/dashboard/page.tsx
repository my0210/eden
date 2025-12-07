import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot, UserSnapshot } from '@/lib/context/getUserSnapshot'
import AppleHealthUpload from './AppleHealthUpload'

type CategoryScores = {
  heart: number
  frame: number
  metabolism: number
  recovery: number
  mind: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function computeCategoryScores(snapshot: UserSnapshot | null): CategoryScores {
  const defaultScores: CategoryScores = { heart: 0, frame: 0, metabolism: 0, recovery: 0, mind: 0 }

  if (!snapshot?.metrics?.length) return defaultScores

  const categoryMetrics: Record<string, number[]> = { heart: [], frame: [], metabolism: [], recovery: [], mind: [] }

  for (const metric of snapshot.metrics) {
    const cat = metric.categoryCode
    const code = metric.metricCode
    const value = metric.latestValue
    if (!cat || value === null) continue

    let score = 50

    if (cat === 'heart') {
      if (code === 'vo2max') score = clamp((value / 60) * 100, 20, 100)
      else if (code?.includes('resting_hr')) score = clamp(100 - ((value - 50) / 30) * 60, 40, 100)
      else if (code === 'blood_pressure') score = value <= 120 ? clamp(90 - (120 - value), 70, 95) : clamp(90 - (value - 120) * 1.5, 30, 90)
      else score = 60
      categoryMetrics.heart.push(score)
    }
    if (cat === 'frame') {
      if (code?.includes('body')) {
        if (value >= 10 && value <= 20) score = clamp(85 - Math.abs(value - 15) * 2, 70, 95)
        else score = value < 10 ? 75 : clamp(80 - (value - 20) * 2, 40, 80)
      } else score = 65
      categoryMetrics.frame.push(score)
    }
    if (cat === 'metabolism') {
      if (code === 'hba1c') score = value <= 5.6 ? clamp(100 - (value - 4.8) * 50, 60, 100) : clamp(40 - (value - 6.0) * 10, 20, 60)
      else if (code?.includes('glucose')) score = (value >= 70 && value <= 100) ? 85 : 60
      else score = 60
      categoryMetrics.metabolism.push(score)
    }
    if (cat === 'recovery') {
      if (code === 'hrv') score = clamp(value, 40, 100)
      else if (code?.includes('sleep')) score = (value >= 7 && value <= 9) ? 90 : clamp(70 + value * 2, 50, 85)
      else score = 60
      categoryMetrics.recovery.push(score)
    }
    if (cat === 'mind') {
      score = clamp(value * 0.9 + 10, 50, 95)
      categoryMetrics.mind.push(score)
    }
  }

  const result = { ...defaultScores }
  for (const cat of Object.keys(categoryMetrics) as Array<keyof CategoryScores>) {
    const scores = categoryMetrics[cat]
    if (scores.length > 0) {
      result[cat] = clamp(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), 0, 100)
    }
  }
  return result
}

const categories = [
  { key: 'heart', label: 'Heart', emoji: '❤️', color: 'bg-rose-500' },
  { key: 'frame', label: 'Frame', emoji: '💪', color: 'bg-amber-500' },
  { key: 'metabolism', label: 'Metabolism', emoji: '🔥', color: 'bg-orange-500' },
  { key: 'recovery', label: 'Recovery', emoji: '😴', color: 'bg-blue-500' },
  { key: 'mind', label: 'Mind', emoji: '🧠', color: 'bg-purple-500' },
] as const

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  let snapshot = null
  try {
    snapshot = await getUserSnapshot(supabase, user.id)
  } catch (e) {
    console.error('Failed to build snapshot', e)
  }

  const scores = computeCategoryScores(snapshot)
  const hasData = Object.values(scores).some(s => s > 0)

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          
          {/* Categories */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Five Pillars</h2>
            <div className="space-y-3">
              {categories.map((cat) => {
                const score = scores[cat.key]
                const hasScore = score > 0
                return (
                  <div key={cat.key} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.emoji}</span>
                        <span className="font-medium text-gray-900">{cat.label}</span>
                      </div>
                      <span className={`text-lg font-bold ${hasScore ? 'text-gray-900' : 'text-gray-300'}`}>
                        {hasScore ? score : '—'}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.color} transition-all duration-500`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* No data message */}
          {!hasData && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>No data yet.</strong> Upload Apple Health data or chat with Eden to start building your profile.
              </p>
            </div>
          )}

          {/* Data Sources */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Data Sources</h2>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Apple Health</p>
                  <p className="text-sm text-gray-500">Activity, heart rate, sleep</p>
                </div>
              </div>
              <AppleHealthUpload userId={user.id} />
            </div>
          </section>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 text-center pt-4">
            Eden is not a medical service. Consult a professional for health concerns.
          </p>

        </div>
      </div>

      {/* Bottom navigation */}
      <nav className="flex border-t border-gray-100 bg-white">
        <Link href="/chat" className="flex-1 flex flex-col items-center py-3 text-gray-400 hover:text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-medium mt-1">Chat</span>
        </Link>
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-emerald-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-medium mt-1">Dashboard</span>
        </Link>
      </nav>
    </main>
  )
}
