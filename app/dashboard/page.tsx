import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot, UserSnapshot } from '@/lib/context/getUserSnapshot'

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
  { key: 'heart', label: 'Heart', gradient: 'from-rose-500 to-pink-600' },
  { key: 'frame', label: 'Frame', gradient: 'from-amber-500 to-orange-600' },
  { key: 'metabolism', label: 'Metabolism', gradient: 'from-yellow-500 to-amber-600' },
  { key: 'recovery', label: 'Recovery', gradient: 'from-cyan-500 to-blue-600' },
  { key: 'mind', label: 'Mind', gradient: 'from-violet-500 to-purple-600' },
] as const

// Pentagon chart helpers
const centerX = 100
const centerY = 100
const radius = 70

function pointFor(score: number, index: number, total: number): string {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const r = (score / 100) * radius
  return `${(centerX + r * Math.cos(angle)).toFixed(1)},${(centerY + r * Math.sin(angle)).toFixed(1)}`
}

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
  
  const dataPoints = categories.map((_, i) => pointFor(scores[categories[i].key], i, 5)).join(' ')
  const outerPoints = categories.map((_, i) => pointFor(100, i, 5)).join(' ')

  return (
    <main className="min-h-screen bg-white">
      {/* Top Navigation */}
      <header className="border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">E</span>
              </div>
              <span className="font-semibold text-gray-900">Eden</span>
            </div>
            <nav className="flex gap-1">
              <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium text-gray-900 bg-gray-100 rounded-full">
                Dashboard
              </Link>
              <Link href="/chat" className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-full">
                Chat
              </Link>
              <Link href="/data" className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-full">
                Data
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        
        {/* Pentagon Visualization */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              {/* Outer pentagon */}
              <polygon points={outerPoints} fill="none" stroke="#e5e7eb" strokeWidth="1" />
              {/* Middle ring */}
              <polygon points={categories.map((_, i) => pointFor(50, i, 5)).join(' ')} fill="none" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4,4" />
              {/* Radial lines */}
              {categories.map((_, i) => {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
                return (
                  <line key={i} x1={centerX} y1={centerY} x2={centerX + radius * Math.cos(angle)} y2={centerY + radius * Math.sin(angle)} stroke="#e5e7eb" strokeWidth="0.5" />
                )
              })}
              {/* Data polygon */}
              {hasData && (
                <polygon points={dataPoints} fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2" />
              )}
              {/* Data points */}
              {hasData && categories.map((cat, i) => {
                const score = scores[cat.key]
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
                const r = (score / 100) * radius
                return (
                  <circle key={cat.key} cx={centerX + r * Math.cos(angle)} cy={centerY + r * Math.sin(angle)} r="4" fill="#10b981" />
                )
              })}
              {/* Labels */}
              {categories.map((cat, i) => {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
                const labelR = radius + 20
                const x = centerX + labelR * Math.cos(angle)
                const y = centerY + labelR * Math.sin(angle)
                return (
                  <text key={cat.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-gray-500 font-medium">
                    {cat.label}
                  </text>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Category Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {categories.map((cat) => {
            const score = scores[cat.key]
            const hasScore = score > 0
            return (
              <div key={cat.key} className={`rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 text-white`}>
                <p className="text-sm font-medium text-white/80 mb-1">{cat.label}</p>
                <p className="text-3xl font-bold">{hasScore ? score : '—'}</p>
                <p className="text-xs text-white/70 mt-1">
                  {hasScore ? (score >= 70 ? 'On track' : 'Room to improve') : 'No data yet'}
                </p>
              </div>
            )
          })}
        </div>

        {/* No data message */}
        {!hasData && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-600">
              Go to <Link href="/data" className="text-emerald-600 font-medium hover:underline">Data</Link> to upload Apple Health data and see your scores.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-gray-400 text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}
