import { UserSnapshot } from '@/lib/context/getUserSnapshot'

type EdenCardProps = {
  snapshot: UserSnapshot | null
  hasProfile: boolean
}

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
  const defaultScores: CategoryScores = {
    heart: 50,
    frame: 50,
    metabolism: 50,
    recovery: 50,
    mind: 50,
  }

  if (!snapshot || !snapshot.metrics || snapshot.metrics.length === 0) {
    return defaultScores
  }

  const categoryMetrics: Record<string, number[]> = {
    heart: [],
    frame: [],
    metabolism: [],
    recovery: [],
    mind: [],
  }

  for (const metric of snapshot.metrics) {
    const cat = metric.categoryCode
    const code = metric.metricCode
    const value = metric.latestValue

    if (!cat || value === null) continue

    let score = 50

    if (cat === 'heart') {
      if (code === 'vo2max') {
        score = clamp((value / 60) * 100, 20, 100)
      } else if (code === 'resting_hr_and_recovery' || code === 'resting_hr') {
        score = clamp(100 - ((value - 50) / 30) * 60, 40, 100)
      } else if (code === 'blood_pressure') {
        score = value <= 120 ? clamp(90 - (120 - value), 70, 95) : clamp(90 - (value - 120) * 1.5, 30, 90)
      } else {
        score = 60
      }
      categoryMetrics.heart.push(score)
    }

    if (cat === 'frame') {
      if (code === 'body_composition' || code === 'body_fat') {
        if (value >= 10 && value <= 20) {
          score = clamp(85 - Math.abs(value - 15) * 2, 70, 95)
        } else if (value < 10) {
          score = 75
        } else {
          score = clamp(80 - (value - 20) * 2, 40, 80)
        }
      } else {
        score = 65
      }
      categoryMetrics.frame.push(score)
    }

    if (cat === 'metabolism') {
      if (code === 'hba1c') {
        if (value <= 5.6) {
          score = clamp(100 - (value - 4.8) * 50, 60, 100)
        } else if (value <= 6.0) {
          score = clamp(60 - (value - 5.6) * 50, 40, 60)
        } else {
          score = clamp(40 - (value - 6.0) * 10, 20, 40)
        }
      } else if (code === 'fasting_glucose') {
        score = (value >= 70 && value <= 100) ? clamp(90 - Math.abs(value - 85) * 0.5, 75, 95) : clamp(70 - Math.abs(value - 85) * 0.5, 40, 70)
      } else {
        score = 60
      }
      categoryMetrics.metabolism.push(score)
    }

    if (cat === 'recovery') {
      if (code === 'hrv') {
        score = clamp(value, 40, 100)
      } else if (code === 'sleep_efficiency_and_duration' || code === 'sleep') {
        if (value >= 7 && value <= 9) {
          score = clamp(85 + (value - 7) * 5, 85, 95)
        } else if (value < 7) {
          score = clamp(70 + value * 2, 50, 85)
        } else {
          score = 80
        }
      } else {
        score = 60
      }
      categoryMetrics.recovery.push(score)
    }

    if (cat === 'mind') {
      score = clamp(value * 0.9 + 10, 50, 95)
      categoryMetrics.mind.push(score)
    }
  }

  const result: CategoryScores = { ...defaultScores }
  for (const cat of Object.keys(categoryMetrics) as Array<keyof CategoryScores>) {
    const scores = categoryMetrics[cat]
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      result[cat] = clamp(Math.round(avg), 20, 100)
    }
  }

  return result
}

const categories = [
  { key: 'heart', label: 'Heart', icon: '❤️', color: 'from-rose-400 to-red-500' },
  { key: 'frame', label: 'Frame', icon: '💪', color: 'from-amber-400 to-orange-500' },
  { key: 'metabolism', label: 'Metabolism', icon: '🔥', color: 'from-yellow-400 to-amber-500' },
  { key: 'recovery', label: 'Recovery', icon: '😴', color: 'from-blue-400 to-indigo-500' },
  { key: 'mind', label: 'Mind', icon: '🧠', color: 'from-purple-400 to-violet-500' },
] as const

const centerX = 100
const centerY = 100
const radius = 80

function pointFor(score: number, index: number, total: number): string {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const r = (score / 100) * radius
  const x = centerX + r * Math.cos(angle)
  const y = centerY + r * Math.sin(angle)
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: 'Excellent', color: 'text-emerald-600' }
  if (score >= 65) return { text: 'Good', color: 'text-emerald-500' }
  if (score >= 50) return { text: 'Fair', color: 'text-amber-500' }
  return { text: 'Needs work', color: 'text-rose-500' }
}

function getOverallScore(scores: CategoryScores): number {
  const values = Object.values(scores)
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

export default function EdenCard({ snapshot }: EdenCardProps) {
  const scores = computeCategoryScores(snapshot)
  const overall = getOverallScore(scores)
  const overallLabel = getScoreLabel(overall)

  const points = categories.map((cat, i) => pointFor(scores[cat.key], i, categories.length)).join(' ')
  const outerPoints = categories.map((_, i) => pointFor(100, i, categories.length)).join(' ')
  const midPoints = categories.map((_, i) => pointFor(50, i, categories.length)).join(' ')

  // Empty state
  if (!snapshot) {
    return (
      <div className="rounded-3xl bg-white border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Your Eden Card</h3>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            Not enough data yet. Connect Apple Health or chat with Eden to build your profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white border border-stone-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Your Eden Card</h3>
            <p className="text-sm text-stone-500">Five dimensions of your health</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-stone-900">{overall}</div>
            <div className={`text-sm font-medium ${overallLabel.color}`}>{overallLabel.text}</div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Radar Chart */}
          <div className="flex-shrink-0 flex justify-center">
            <svg viewBox="0 0 200 200" className="w-52 h-52">
              {/* Background rings */}
              <polygon points={outerPoints} className="fill-emerald-50/50" stroke="#e7e5e4" strokeWidth={1} />
              <polygon points={midPoints} className="fill-none" stroke="#e7e5e4" strokeWidth={0.5} strokeDasharray="4,4" />
              
              {/* Radial lines */}
              {categories.map((_, i) => {
                const angle = (Math.PI * 2 * i) / categories.length - Math.PI / 2
                return (
                  <line
                    key={i}
                    x1={centerX}
                    y1={centerY}
                    x2={centerX + radius * Math.cos(angle)}
                    y2={centerY + radius * Math.sin(angle)}
                    stroke="#e7e5e4"
                    strokeWidth={0.5}
                  />
                )
              })}

              {/* Data polygon */}
              <polygon
                points={points}
                className="fill-emerald-400/20"
                stroke="#10b981"
                strokeWidth={2}
              />

              {/* Category dots */}
              {categories.map((cat, i) => {
                const score = scores[cat.key]
                const angle = (Math.PI * 2 * i) / categories.length - Math.PI / 2
                const r = (score / 100) * radius
                const x = centerX + r * Math.cos(angle)
                const y = centerY + r * Math.sin(angle)
                return (
                  <circle
                    key={cat.key}
                    cx={x}
                    cy={y}
                    r={5}
                    className="fill-emerald-500"
                    stroke="white"
                    strokeWidth={2}
                  />
                )
              })}

              {/* Center score */}
              <circle cx={centerX} cy={centerY} r={24} className="fill-white" stroke="#e7e5e4" strokeWidth={1} />
              <text x={centerX} y={centerY + 6} textAnchor="middle" className="fill-stone-900 text-lg font-bold">{overall}</text>
            </svg>
          </div>

          {/* Category breakdown */}
          <div className="flex-1 space-y-3">
            {categories.map((cat) => {
              const score = scores[cat.key]
              const label = getScoreLabel(score)
              return (
                <div key={cat.key} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-sm font-medium text-stone-700">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
                      <span className="text-sm font-semibold text-stone-900 w-8 text-right">{score}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${cat.color} transition-all duration-500`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
