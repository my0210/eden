'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types'
import ScorecardView from '@/components/scorecard/ScorecardView'
import { selectPriorityDomains, getDomainPreview, DomainSelection } from '@/lib/coaching/selectPriorityDomains'

interface Step6ScorecardRevealProps {
  userId: string
}

type Step = 'loading' | 'scorecard' | 'focus'

const DOMAIN_COLORS: Record<PrimeDomain, string> = {
  heart: '#FF2D55',
  frame: '#5856D6',
  metabolism: '#FF9500',
  recovery: '#34C759',
  mind: '#007AFF',
}

const DOMAIN_ICONS: Record<PrimeDomain, React.ReactNode> = {
  heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  frame: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  metabolism: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
  recovery: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
  mind: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
}

export default function Step6ScorecardReveal({ userId }: Step6ScorecardRevealProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [scorecard, setScorecard] = useState<PrimeScorecard | null>(null)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Focus selection state
  const [timeBudget, setTimeBudget] = useState<number>(5) // hours per week
  const [selectedPrimary, setSelectedPrimary] = useState<PrimeDomain | null>(null)
  const [selectedSecondary, setSelectedSecondary] = useState<PrimeDomain | null>(null)

  useEffect(() => {
    loadScorecard()
  }, [])

  // Calculate recommended domains when scorecard changes
  const recommendation = useMemo<DomainSelection | null>(() => {
    if (!scorecard) return null
    return selectPriorityDomains({
      scorecard,
      timeBudgetHoursPerWeek: timeBudget,
    })
  }, [scorecard, timeBudget])

  // Set initial selections from recommendation
  useEffect(() => {
    if (recommendation && !selectedPrimary) {
      setSelectedPrimary(recommendation.primary)
      setSelectedSecondary(recommendation.secondary)
    }
  }, [recommendation, selectedPrimary])

  function hasAllScores(sc: PrimeScorecard): boolean {
    if (sc.prime_score === null) return false
    for (const d of PRIME_DOMAINS) {
      if (sc.domain_scores[d] === null) return false
    }
    return true
  }

  async function loadScorecard() {
    setStep('loading')
    setError(null)

    try {
      // Try to get latest scorecard first
      const latestRes = await fetch('/api/prime-scorecard/latest')

      if (latestRes.ok) {
        const data = await latestRes.json()
        const latest = data.scorecard as PrimeScorecard
        if (latest && hasAllScores(latest)) {
          setScorecard(latest)
          setStep('scorecard')
          return
        }
      }

      // If no scorecard exists (404), generate one
      if (latestRes.status === 404 || latestRes.ok) {
        const generateRes = await fetch('/api/prime-scorecard/generate', {
          method: 'POST',
        })

        if (generateRes.ok) {
          const data = await generateRes.json()
          setScorecard(data.scorecard as PrimeScorecard)
          setStep('scorecard')
        } else {
          setError('Failed to generate scorecard')
        }
      } else {
        setError('Failed to load scorecard')
      }
    } catch (err) {
      console.error('Scorecard load error:', err)
      setError('Network error')
    }
  }

  async function handleContinueToFocus() {
    setStep('focus')
  }

  async function handleComplete() {
    if (!selectedPrimary) {
      setError('Please select at least a primary focus')
      return
    }

    setCompleting(true)

    try {
      // Save domain selection
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 6,
          onboarding_status: 'completed',
          patch: {
            domain_selection: {
              primary: selectedPrimary,
              secondary: selectedSecondary,
              time_budget_hours: timeBudget,
              reasoning: recommendation?.reasoning,
            },
          },
        }),
      })

      if (res.ok) {
        // Use replace to prevent back-button returning to onboarding
        router.replace('/chat')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Complete onboarding error:', errorData)
        setError('Failed to complete onboarding')
        setCompleting(false)
      }
    } catch (err) {
      console.error('Complete error:', err)
      setError('Network error')
      setCompleting(false)
    }
  }

  // Loading state
  if (step === 'loading') {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-[#007AFF]/10 to-[#34C759]/10 rounded-2xl p-8 text-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#007AFF]/50 to-[#34C759]/50 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-black mb-2">Generating Your Scorecard</h2>
          <p className="text-[15px] text-[#8E8E93]">Analyzing your health data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && step !== 'focus') {
    return (
      <div className="space-y-6">
        <div className="bg-[#FF3B30]/10 rounded-2xl p-6 text-center">
          <p className="text-[17px] text-[#FF3B30] mb-4">{error}</p>
          <button onClick={loadScorecard} className="text-[#007AFF] font-semibold">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!scorecard) {
    return null
  }

  // Scorecard reveal step
  if (step === 'scorecard') {
    return (
      <div className="space-y-6">
        <ScorecardView scorecard={scorecard} showHowCalculated={true} />

        <div className="text-center py-2">
          <p className="text-[17px] text-[#34C759] font-medium">
            ✓ Your scorecard is ready!
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5EA]">
          <Link
            href="/onboarding/5"
            className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
          >
            Back
          </Link>

          <button
            onClick={handleContinueToFocus}
            className="bg-[#007AFF] text-white py-3 px-8 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] transition-colors"
          >
            Choose Focus Areas →
          </button>
        </div>
      </div>
    )
  }

  // Focus selection step
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-[22px] font-bold text-black mb-2">Your Focus Areas</h2>
        <p className="text-[15px] text-[#8E8E93]">
          Based on your scorecard, here&apos;s where you&apos;ll see the most impact.
        </p>
      </div>

      {/* Recommended domains */}
      {recommendation && (
        <div className="space-y-4">
          {/* Primary */}
          <DomainCard
            domain={selectedPrimary || recommendation.primary}
            priority="primary"
            reasoning={recommendation.reasoning.primary}
            isSelected={true}
            scorecard={scorecard}
            onSelect={() => {}}
            onDeselect={() => {}}
          />

          {/* Secondary */}
          {(selectedSecondary || recommendation.secondary) && (
            <DomainCard
              domain={selectedSecondary || recommendation.secondary!}
              priority="secondary"
              reasoning={recommendation.reasoning.secondary || ''}
              isSelected={!!selectedSecondary}
              scorecard={scorecard}
              onSelect={() => setSelectedSecondary(recommendation.secondary)}
              onDeselect={() => setSelectedSecondary(null)}
            />
          )}
        </div>
      )}

      {/* Time budget */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4">
        <label className="block text-[15px] font-semibold text-black mb-3">
          How much time can you dedicate per week?
        </label>
        <div className="flex gap-2">
          {[3, 5, 7, 10].map((hours) => (
            <button
              key={hours}
              onClick={() => setTimeBudget(hours)}
              className={`flex-1 py-3 px-4 rounded-xl text-[15px] font-medium transition-colors ${
                timeBudget === hours
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-[#F2F2F7] text-black hover:bg-[#E5E5EA]'
              }`}
            >
              {hours}h
            </button>
          ))}
        </div>
        <p className="text-[13px] text-[#8E8E93] mt-2">
          {timeBudget <= 3 && 'Light commitment - perfect for building habits'}
          {timeBudget === 5 && 'Moderate commitment - good balance'}
          {timeBudget === 7 && 'Strong commitment - you\'ll see faster results'}
          {timeBudget >= 10 && 'High commitment - ambitious but achievable'}
        </p>
      </div>

      {/* Adjust link */}
      <div className="text-center">
        <button
          onClick={() => setStep('scorecard')}
          className="text-[15px] text-[#8E8E93] hover:text-[#007AFF] transition-colors"
        >
          Want to adjust? Go back to scorecard
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#FF3B30]/10 rounded-xl p-3 text-[#FF3B30] text-[15px] text-center">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5EA]">
        <button
          onClick={() => setStep('scorecard')}
          className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
        >
          Back
        </button>

        <button
          onClick={handleComplete}
          disabled={completing || !selectedPrimary}
          className="bg-[#34C759] text-white py-3 px-8 rounded-xl text-[17px] font-semibold hover:bg-[#2DB84D] active:bg-[#28A745] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {completing ? 'Starting...' : 'Start with Eden →'}
        </button>
      </div>
    </div>
  )
}

// Domain card component
function DomainCard({
  domain,
  priority,
  reasoning,
  isSelected,
  scorecard,
  onSelect,
  onDeselect,
}: {
  domain: PrimeDomain
  priority: 'primary' | 'secondary' | 'tertiary'
  reasoning: string
  isSelected: boolean
  scorecard: PrimeScorecard
  onSelect: () => void
  onDeselect: () => void
}) {
  const color = DOMAIN_COLORS[domain]
  const score = scorecard.domain_scores[domain]
  const confidence = scorecard.domain_confidence[domain]
  const preview = getDomainPreview(domain)

  const priorityLabel = priority === 'primary' ? 'Primary Focus' : 'Secondary Focus'

  return (
    <div
      className={`bg-white rounded-2xl border-2 p-4 transition-colors ${
        isSelected ? 'border-[#007AFF]' : 'border-[#E5E5EA]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <svg className="w-6 h-6" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {DOMAIN_ICONS[domain]}
          </svg>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <span
                className="text-[11px] font-medium uppercase tracking-wide"
                style={{ color }}
              >
                {priorityLabel}
              </span>
              <h3 className="text-[17px] font-semibold text-black capitalize">{domain}</h3>
            </div>
            {score !== null && (
              <div className="text-right">
                <div className="text-[22px] font-bold" style={{ color }}>
                  {score}
                </div>
                <div className="text-[11px] text-[#8E8E93]">{confidence}% conf.</div>
              </div>
            )}
          </div>

          <p className="text-[15px] text-[#3C3C43] mt-1">{preview}</p>
          <p className="text-[13px] text-[#8E8E93] mt-2">{reasoning}</p>
        </div>
      </div>

      {priority === 'secondary' && (
        <div className="flex justify-end mt-3 pt-3 border-t border-[#E5E5EA]">
          {isSelected ? (
            <button
              onClick={onDeselect}
              className="text-[13px] text-[#8E8E93] hover:text-[#FF3B30] transition-colors"
            >
              Remove secondary focus
            </button>
          ) : (
            <button
              onClick={onSelect}
              className="text-[13px] text-[#007AFF] hover:opacity-70 transition-opacity"
            >
              Add as secondary focus
            </button>
          )}
        </div>
      )}
    </div>
  )
}
