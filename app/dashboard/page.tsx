import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot, UserSnapshot } from '@/lib/context/getUserSnapshot'
import ProfileMenu from './ProfileMenu'

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
  { key: 'heart', label: 'Heart' },
  { key: 'frame', label: 'Frame' },
  { key: 'metabolism', label: 'Metabolism' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'mind', label: 'Mind' },
] as const

// Pentagon helpers
const centerX = 100, centerY = 100, radius = 70

function pointFor(score: number, index: number): string {
  const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2
  const r = (score / 100) * radius
  return `${(centerX + r * Math.cos(angle)).toFixed(1)},${(centerY + r * Math.sin(angle)).toFixed(1)}`
}

function getStatusColor(score: number): string {
  if (score >= 70) return 'text-[#c8ff00]'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function getStatusText(score: number): string {
  if (score >= 70) return 'On track'
  if (score >= 50) return 'Okay'
  return 'Needs work'
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
  
  const dataPoints = categories.map((_, i) => pointFor(scores[categories[i].key], i)).join(' ')
  const outerPoints = categories.map((_, i) => pointFor(100, i)).join(' ')

  // Group metrics by category
  const metricsByCategory: Record<string, Array<{ name: string; value: number | null }>> = {
    heart: [], frame: [], metabolism: [], recovery: [], mind: []
  }
  
  if (snapshot?.metrics) {
    for (const m of snapshot.metrics) {
      if (m.categoryCode && metricsByCategory[m.categoryCode]) {
        metricsByCategory[m.categoryCode].push({
          name: m.metricName || m.metricCode || 'Unknown',
          value: m.latestValue,
        })
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-semibold">Eden</Link>
            <nav className="flex gap-6">
              <Link href="/dashboard" className="text-sm text-white">Dashboard</Link>
              <Link href="/chat" className="text-sm text-white/50 hover:text-white">Chat</Link>
              <Link href="/data" className="text-sm text-white/50 hover:text-white">Data</Link>
            </nav>
          </div>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Pentagon */}
        <div className="flex justify-center mb-12">
          <svg viewBox="0 0 200 200" className="w-56 h-56">
            <polygon points={outerPoints} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <polygon points={categories.map((_, i) => pointFor(50, i)).join(' ')} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            {categories.map((_, i) => {
              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
              return <line key={i} x1={centerX} y1={centerY} x2={centerX + radius * Math.cos(angle)} y2={centerY + radius * Math.sin(angle)} stroke="rgba(255,255,255,0.05)" />
            })}
            {hasData && <polygon points={dataPoints} fill="rgba(200, 255, 0, 0.15)" stroke="#c8ff00" strokeWidth="2" />}
            {hasData && categories.map((cat, i) => {
              const score = scores[cat.key]
              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
              const r = (score / 100) * radius
              return <circle key={cat.key} cx={centerX + r * Math.cos(angle)} cy={centerY + r * Math.sin(angle)} r="4" fill="#c8ff00" />
            })}
            {categories.map((cat, i) => {
              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
              const x = centerX + (radius + 24) * Math.cos(angle)
              const y = centerY + (radius + 24) * Math.sin(angle)
              return <text key={cat.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[11px] fill-white/50">{cat.label}</text>
            })}
          </svg>
        </div>

        {/* Category Cards */}
        <div className="space-y-4">
          {categories.map((cat) => {
            const score = scores[cat.key]
            const metrics = metricsByCategory[cat.key]
            const hasScore = score > 0

            return (
              <div key={cat.key} className="rounded-2xl bg-[#141414] border border-white/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">{cat.label}</h3>
                  <div className="flex items-center gap-3">
                    {hasScore && (
                      <span className={`text-sm font-medium ${getStatusColor(score)}`}>
                        {getStatusText(score)}
                      </span>
                    )}
                    <span className="text-2xl font-bold">{hasScore ? score : '—'}</span>
                  </div>
                </div>
                
                {metrics.length > 0 ? (
                  <div className="space-y-2">
                    {metrics.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-white/50">{m.name}</span>
                        <span className="text-white/80">
                          {m.value !== null ? m.value : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/30">No metrics yet</p>
                )}
              </div>
            )
          })}
        </div>

        {!hasData && (
          <div className="mt-8 text-center">
            <p className="text-white/50">
              <Link href="/data" className="text-[#c8ff00] hover:underline">Upload data</Link> to see your health metrics.
            </p>
          </div>
        )}

        <p className="text-xs text-white/20 text-center mt-12">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}
