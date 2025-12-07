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

    // Heart metrics
    if (cat === 'heart') {
      if (code === 'vo2max') {
        // VO2max: 60+ is elite, scale to 100
        score = clamp((value / 60) * 100, 20, 100)
      } else if (code === 'resting_hr_and_recovery' || code === 'resting_hr') {
        // Resting HR: lower is better, 50 bpm → 100, 80 bpm → 40
        score = clamp(100 - ((value - 50) / 30) * 60, 40, 100)
      } else if (code === 'blood_pressure') {
        // Blood pressure (systolic): 110-120 is ideal
        if (value <= 120) {
          score = clamp(90 - (120 - value), 70, 95)
        } else {
          score = clamp(90 - (value - 120) * 1.5, 30, 90)
        }
      } else {
        score = 60 // default for unknown heart metrics
      }
      categoryMetrics.heart.push(score)
    }

    // Frame metrics
    if (cat === 'frame') {
      if (code === 'body_composition' || code === 'body_fat') {
        // Body fat %: 10-20% is good for men, adjust score
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

    // Metabolism metrics
    if (cat === 'metabolism') {
      if (code === 'hba1c') {
        // HbA1c: 4.8-5.6 is normal
        if (value <= 5.6) {
          score = clamp(100 - (value - 4.8) * 50, 60, 100)
        } else if (value <= 6.0) {
          score = clamp(60 - (value - 5.6) * 50, 40, 60)
        } else {
          score = clamp(40 - (value - 6.0) * 10, 20, 40)
        }
      } else if (code === 'fasting_glucose') {
        // Fasting glucose: 70-100 mg/dL is normal
        if (value >= 70 && value <= 100) {
          score = clamp(90 - Math.abs(value - 85) * 0.5, 75, 95)
        } else {
          score = clamp(70 - Math.abs(value - 85) * 0.5, 40, 70)
        }
      } else {
        score = 60
      }
      categoryMetrics.metabolism.push(score)
    }

    // Recovery metrics
    if (cat === 'recovery') {
      if (code === 'hrv') {
        // HRV: 40-100 ms maps to 40-100 score
        score = clamp(value, 40, 100)
      } else if (code === 'sleep_efficiency_and_duration' || code === 'sleep') {
        // Sleep hours: 7-9 is ideal
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

    // Mind metrics
    if (cat === 'mind') {
      // Generic mind score mapping
      score = clamp(value * 0.9 + 10, 50, 95)
      categoryMetrics.mind.push(score)
    }
  }

  // Average scores per category, default to 50 if no metrics
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

const axes = [
  { key: 'heart', label: 'Heart' },
  { key: 'frame', label: 'Frame' },
  { key: 'metabolism', label: 'Metabolism' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'mind', label: 'Mind' },
] as const

const centerX = 80
const centerY = 80
const radius = 60

function pointFor(score: number, index: number, total: number): string {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const r = (score / 100) * radius
  const x = centerX + r * Math.cos(angle)
  const y = centerY + r * Math.sin(angle)
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

function getStrengthsAndOpportunities(scores: CategoryScores) {
  const sorted = axes
    .map((axis) => ({ key: axis.key, label: axis.label, score: scores[axis.key] }))
    .sort((a, b) => b.score - a.score)

  return {
    top1: sorted[0],
    bottom1: sorted[sorted.length - 1],
  }
}

function formatSnapshotDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 5) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getScoreDescriptor(score: number): string {
  if (score >= 80) return 'strong'
  if (score >= 65) return 'solid'
  if (score >= 50) return 'ok'
  return 'lagging'
}

export default function EdenCard({ snapshot, hasProfile }: EdenCardProps) {
  const scores = computeCategoryScores(snapshot)
  const { top1, bottom1 } = getStrengthsAndOpportunities(scores)

  const points = axes.map((axis, index) => pointFor(scores[axis.key], index, axes.length)).join(' ')
  const backgroundPoints = axes.map((_, i) => pointFor(100, i, axes.length)).join(' ')

  // No snapshot state
  if (!snapshot) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 shadow-sm p-5">
        <div className="text-center py-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-slate-50 px-2 py-0.5">
            <span>🧠</span>
            <span>Eden card</span>
          </span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">Current profile</h2>
          <p className="mt-2 text-sm text-slate-700 max-w-md mx-auto">
            There isn&apos;t enough data yet to build your Eden card.
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Once Eden has some basic profile information and metrics, your card will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 shadow-sm p-5 flex flex-col lg:flex-row gap-6">
      {/* Left side: Radar chart */}
      <div className="flex-shrink-0 lg:w-56">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-slate-50 px-2 py-0.5">
            <span>🧠</span>
            <span>Eden card</span>
          </span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">Current profile</h2>
          <p className="mt-1 text-xs text-slate-500">
            Updated from your latest available metrics.
          </p>
        </div>

        {/* Radar SVG */}
        <svg viewBox="0 0 160 160" className="w-40 h-40 mx-auto mt-4">
          {/* Background polygon */}
          <polygon points={backgroundPoints} className="fill-indigo-50 stroke-indigo-100" strokeWidth={1} />
          {/* Middle ring */}
          <polygon
            points={axes.map((_, i) => pointFor(50, i, axes.length)).join(' ')}
            className="fill-none stroke-slate-200"
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
          {/* Radial lines */}
          {axes.map((axis, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
            return (
              <line
                key={axis.key}
                x1={centerX}
                y1={centerY}
                x2={centerX + radius * Math.cos(angle)}
                y2={centerY + radius * Math.sin(angle)}
                className="stroke-slate-200"
                strokeWidth={0.6}
              />
            )
          })}
          {/* User polygon */}
          <polygon points={points} className="fill-indigo-200/70 stroke-indigo-500" strokeWidth={1.5} />
          {/* Center dot */}
          <circle cx={centerX} cy={centerY} r={2} className="fill-indigo-400" />
        </svg>

        {/* Category score chips */}
        <div className="mt-4 space-y-1.5">
          {axes.map((axis) => {
            const score = scores[axis.key]
            const descriptor = getScoreDescriptor(score)
            return (
              <p key={axis.key} className="text-[11px] text-slate-600">
                <span className="font-medium text-slate-900">{axis.label}</span>
                <span className="mx-1">·</span>
                <span className="font-semibold">{score}</span>
                <span className="ml-1 text-slate-400">{descriptor}</span>
              </p>
            )
          })}
        </div>
      </div>

      {/* Right side: Summary */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Your strongest area right now is <span className="font-semibold">{top1.label}</span>.
            The main opportunity is <span className="font-semibold">{bottom1.label}</span>.
          </p>
          <p className="text-xs text-slate-500">
            Eden combines your metrics into five domains so you can see where you&apos;re strong and where small changes could help.
          </p>
        </div>
      </div>
    </div>
  )
}
