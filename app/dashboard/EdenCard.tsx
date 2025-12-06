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
    top2: sorted[1],
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

  if (diffMins < 5) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function EdenCard({ snapshot, hasProfile }: EdenCardProps) {
  const scores = computeCategoryScores(snapshot)
  const { top1, top2, bottom1 } = getStrengthsAndOpportunities(scores)

  const points = axes.map((axis, index) => pointFor(scores[axis.key], index, axes.length)).join(' ')
  const backgroundPoints = axes.map((_, i) => pointFor(100, i, axes.length)).join(' ')

  // No snapshot state
  if (!snapshot) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 shadow-sm p-5">
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 mb-4">
            <span>🎴</span>
            <span>Eden Primespan Card</span>
          </div>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            No Eden snapshot yet. Once Eden has your basic profile and a few metrics, your card will appear here.
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
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 border border-indigo-100">
            <span>🎴</span>
            <span>Eden Primespan Card</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">Overall Profile</p>
          {!hasProfile && (
            <span className="inline-block mt-1 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">
              Getting to know you
            </span>
          )}
          {snapshot.createdAt && (
            <p className="mt-1 text-xs text-slate-400">Updated {formatSnapshotDate(snapshot.createdAt)}</p>
          )}
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
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 text-xs">
          {axes.map((axis) => (
            <div
              key={axis.key}
              className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-2 py-1.5"
            >
              <span className="text-slate-600">{axis.label}</span>
              <span className="font-semibold text-indigo-600">{scores[axis.key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right side: Summary */}
      <div className="flex-1 flex flex-col justify-center">
        {!hasProfile ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              I don&apos;t know you well enough yet to personalise fully. Start with Eden on WhatsApp to fill in basics,
              then this card will update with your personalised health profile.
            </p>
            <a
              href="https://wa.me/14155238886?text=Hi%20Eden"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-medium px-4 py-2 hover:bg-emerald-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Start onboarding on WhatsApp
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              <span className="font-semibold text-indigo-600">{top1.label}</span> and{' '}
              <span className="font-semibold text-indigo-600">{top2.label}</span> are your relative strengths right
              now. <span className="font-semibold text-amber-600">{bottom1.label}</span> is where Eden will likely
              focus first.
            </p>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">
                  ✓
                </span>
                <span className="text-slate-600">
                  Top strength: <span className="font-medium text-slate-800">{top1.label}</span>
                  <span className="text-slate-400 ml-1">({top1.score})</span>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-xs">
                  ✓
                </span>
                <span className="text-slate-600">
                  Secondary strength: <span className="font-medium text-slate-800">{top2.label}</span>
                  <span className="text-slate-400 ml-1">({top2.score})</span>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">
                  →
                </span>
                <span className="text-slate-600">
                  Main opportunity: <span className="font-medium text-slate-800">{bottom1.label}</span>
                  <span className="text-slate-400 ml-1">({bottom1.score})</span>
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

