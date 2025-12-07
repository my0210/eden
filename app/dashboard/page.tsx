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
  { key: 'heart', label: 'Heart', icon: '♥' },
  { key: 'frame', label: 'Frame', icon: '◼' },
  { key: 'metabolism', label: 'Metabolism', icon: '⚡' },
  { key: 'recovery', label: 'Recovery', icon: '☾' },
  { key: 'mind', label: 'Mind', icon: '◉' },
] as const

// Pentagon helpers
const centerX = 100, centerY = 100, radius = 70

function pointFor(score: number, index: number): string {
  const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2
  const r = (score / 100) * radius
  return `${(centerX + r * Math.cos(angle)).toFixed(1)},${(centerY + r * Math.sin(angle)).toFixed(1)}`
}

function getStatusColor(score: number): string {
  if (score >= 70) return 'text-[#34C759]' // Apple green
  if (score >= 50) return 'text-[#FF9500]' // Apple orange
  return 'text-[#FF3B30]' // Apple red
}

function getStatusBg(score: number): string {
  if (score >= 70) return 'bg-[#34C759]'
  if (score >= 50) return 'bg-[#FF9500]'
  return 'bg-[#FF3B30]'
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
    <main className="min-h-screen bg-[#F2F2F7]">
      {/* Navigation - Apple style */}
      <header className="bg-[#F2F2F7]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-[17px] font-semibold text-[#007AFF]">Dashboard</Link>
            <Link href="/chat" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Chat</Link>
            <Link href="/data" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Data</Link>
          </nav>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-[28px] font-bold tracking-tight text-black mb-6">Eden</h1>

        {/* Pentagon Card */}
        <div className="bg-white rounded-xl shadow-sm mb-4">
          <div className="p-6 flex justify-center">
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              {/* Grid rings */}
              <polygon points={outerPoints} fill="none" stroke="#E5E5EA" strokeWidth="1" />
              <polygon points={categories.map((_, i) => pointFor(75, i)).join(' ')} fill="none" stroke="#E5E5EA" strokeWidth="0.5" />
              <polygon points={categories.map((_, i) => pointFor(50, i)).join(' ')} fill="none" stroke="#E5E5EA" strokeWidth="0.5" />
              <polygon points={categories.map((_, i) => pointFor(25, i)).join(' ')} fill="none" stroke="#E5E5EA" strokeWidth="0.5" />
              {/* Radial lines */}
              {categories.map((_, i) => {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
                return <line key={i} x1={centerX} y1={centerY} x2={centerX + radius * Math.cos(angle)} y2={centerY + radius * Math.sin(angle)} stroke="#E5E5EA" strokeWidth="0.5" />
              })}
              {/* Data polygon */}
              {hasData && <polygon points={dataPoints} fill="rgba(0, 122, 255, 0.15)" stroke="#007AFF" strokeWidth="2" />}
              {/* Data points */}
              {hasData && categories.map((cat, i) => {
                const score = scores[cat.key]
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
                const r = (score / 100) * radius
                return <circle key={cat.key} cx={centerX + r * Math.cos(angle)} cy={centerY + r * Math.sin(angle)} r="4" fill="#007AFF" />
              })}
              {/* Labels */}
              {categories.map((cat, i) => {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
                const x = centerX + (radius + 20) * Math.cos(angle)
                const y = centerY + (radius + 20) * Math.sin(angle)
                return <text key={cat.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[11px] fill-[#8E8E93] font-medium">{cat.label}</text>
              })}
            </svg>
          </div>
        </div>

        {/* Category List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {categories.map((cat, idx) => {
            const score = scores[cat.key]
            const metrics = metricsByCategory[cat.key]
            const hasScore = score > 0

            return (
              <div key={cat.key}>
                {idx > 0 && <div className="h-px bg-[#C6C6C8] mx-4" />}
                <div className="px-4 py-3">
                  {/* Category header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-[17px] font-semibold text-black">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasScore && (
                        <span className={`w-2 h-2 rounded-full ${getStatusBg(score)}`} />
                      )}
                      <span className="text-[22px] font-bold text-black tabular-nums">
                        {hasScore ? score : '—'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Metrics */}
                  {metrics.length > 0 ? (
                    <div className="space-y-1 ml-8">
                      {metrics.map((m, mIdx) => (
                        <div key={mIdx} className="flex items-center justify-between">
                          <span className="text-[15px] text-[#8E8E93]">{m.name}</span>
                          <span className="text-[15px] text-[#3C3C43] tabular-nums">
                            {m.value !== null ? m.value : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#8E8E93] ml-8">No data yet</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {!hasData && (
          <div className="mt-4 bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-[15px] text-[#8E8E93]">
              <Link href="/data" className="text-[#007AFF]">Import data</Link> to see your health metrics.
            </p>
          </div>
        )}

        <p className="text-[11px] text-[#8E8E93] text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}
