'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types'

interface Step6ScorecardRevealProps {
  userId: string
}

/**
 * Get confidence label and color
 */
function getConfidenceDisplay(confidence: number): { 
  label: 'Low' | 'Medium' | 'High'
  color: string 
  bgColor: string
  copy: string
} {
  if (confidence < 40) {
    return {
      label: 'Low',
      color: 'text-[#FF9500]',
      bgColor: 'bg-[#FF9500]/10',
      copy: 'Estimated from quick checks',
    }
  }
  if (confidence < 70) {
    return {
      label: 'Medium',
      color: 'text-[#007AFF]',
      bgColor: 'bg-[#007AFF]/10',
      copy: 'Based on measurements you provided',
    }
  }
  return {
    label: 'High',
    color: 'text-[#34C759]',
    bgColor: 'bg-[#34C759]/10',
    copy: 'Based on device, lab, or test data',
  }
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number | null): string {
  if (score === null) return 'text-[#8E8E93]'
  if (score >= 80) return 'text-[#34C759]'
  if (score >= 60) return 'text-[#007AFF]'
  if (score >= 40) return 'text-[#FF9500]'
  return 'text-[#FF3B30]'
}

/**
 * Domain display info
 */
const domainDisplay: Record<PrimeDomain, { label: string; icon: string; color: string }> = {
  heart: { label: 'Heart', icon: '❤️', color: '#FF2D55' },
  frame: { label: 'Frame', icon: '🏋️', color: '#5856D6' },
  metabolism: { label: 'Metabolism', icon: '⚡', color: '#FF9500' },
  recovery: { label: 'Recovery', icon: '🌙', color: '#34C759' },
  mind: { label: 'Mind', icon: '🧠', color: '#007AFF' },
}

/**
 * Upgrade action suggestions by domain
 */
const upgradeActions: Record<PrimeDomain, string> = {
  heart: 'Connect Apple Health or add blood pressure',
  frame: 'Add waist measurement',
  metabolism: 'Add recent lab results (ApoB, HbA1c)',
  recovery: 'Connect a sleep tracker',
  mind: 'Focus Check coming soon',
}

/**
 * Evidence chip showing source type
 */
function EvidenceChip({ type }: { type: string }) {
  const chipConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    device: { label: 'Device', color: 'text-[#34C759]', bgColor: 'bg-[#34C759]/10' },
    lab: { label: 'Lab', color: 'text-[#5856D6]', bgColor: 'bg-[#5856D6]/10' },
    measurement: { label: 'Measurement', color: 'text-[#007AFF]', bgColor: 'bg-[#007AFF]/10' },
    self_report: { label: 'Self-report', color: 'text-[#FF9500]', bgColor: 'bg-[#FF9500]/10' },
    estimated: { label: 'Estimated', color: 'text-[#8E8E93]', bgColor: 'bg-[#8E8E93]/10' },
    pending: { label: 'Pending', color: 'text-[#8E8E93]', bgColor: 'bg-[#8E8E93]/10' },
  }
  
  const config = chipConfig[type] || chipConfig.estimated
  
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${config.color} ${config.bgColor}`}>
      {config.label}
    </span>
  )
}

/**
 * Domain Card with evidence and upgrade action
 */
function DomainCard({ 
  domain, 
  scorecard,
  expanded,
  onToggle 
}: { 
  domain: PrimeDomain
  scorecard: PrimeScorecard
  expanded: boolean
  onToggle: () => void
}) {
  const display = domainDisplay[domain]
  const score = scorecard.domain_scores[domain]
  const confidence = scorecard.domain_confidence[domain]
  const confidenceDisplay = getConfidenceDisplay(confidence)
  const howCalculated = scorecard.how_calculated[domain]
  
  // Determine primary evidence type from how_calculated
  const getEvidenceType = (): string => {
    const calc = howCalculated.join(' ').toLowerCase()
    if (calc.includes('device')) return 'device'
    if (calc.includes('lab')) return 'lab'
    if (calc.includes('measurement')) return 'measurement'
    if (calc.includes('self-report') || calc.includes('proxy')) return 'self_report'
    if (calc.includes('prior') || calc.includes('estimated')) return 'estimated'
    return 'self_report'
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E5EA] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F2F2F7]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${display.color}20` }}
          >
            <span className="text-xl">{display.icon}</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-semibold text-black">{display.label}</span>
              <EvidenceChip type={getEvidenceType()} />
            </div>
            <span className={`text-[13px] ${confidenceDisplay.color}`}>
              {confidenceDisplay.label} confidence
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[28px] font-bold tabular-nums ${getScoreColor(score)}`}>
            {score !== null ? Math.round(score) : '—'}
          </span>
          <svg 
            className={`w-5 h-5 text-[#8E8E93] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 bg-[#F2F2F7] border-t border-[#E5E5EA] space-y-3">
          {/* Confidence explanation */}
          <div className={`p-2 rounded-lg ${confidenceDisplay.bgColor}`}>
            <p className={`text-[13px] ${confidenceDisplay.color}`}>
              {confidenceDisplay.copy}
            </p>
          </div>
          
          {/* How calculated */}
          {howCalculated.length > 0 && (
            <div className="space-y-1">
              <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">
                How we calculated this
              </p>
              {howCalculated.map((line, idx) => (
                <p key={idx} className="text-[13px] text-[#3C3C43]">
                  {line}
                </p>
              ))}
            </div>
          )}
          
          {/* Upgrade action */}
          {confidenceDisplay.label !== 'High' && (
            <div className="pt-2 border-t border-[#E5E5EA]">
              <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide mb-1">
                Improve accuracy
              </p>
              <p className="text-[13px] text-[#007AFF]">
                → {upgradeActions[domain]}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Step6ScorecardReveal({ userId }: Step6ScorecardRevealProps) {
  const router = useRouter()
  const [scorecard, setScorecard] = useState<PrimeScorecard | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedDomain, setExpandedDomain] = useState<PrimeDomain | null>(null)

  useEffect(() => {
    loadScorecard()
  }, [])

  async function loadScorecard() {
    setLoading(true)
    setError(null)

    try {
      // Try to get latest scorecard first
      const latestRes = await fetch('/api/prime-scorecard/latest')
      
      if (latestRes.ok) {
        const data = await latestRes.json()
        setScorecard(data.scorecard)
        setLoading(false)
        return
      }

      // If no scorecard exists (404), generate one
      if (latestRes.status === 404) {
        const generateRes = await fetch('/api/prime-scorecard/generate', {
          method: 'POST',
        })

        if (generateRes.ok) {
          const data = await generateRes.json()
          setScorecard(data.scorecard)
        } else {
          setError('Failed to generate scorecard')
        }
      } else {
        setError('Failed to load scorecard')
      }
    } catch (err) {
      console.error('Scorecard load error:', err)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete() {
    setCompleting(true)
    
    try {
      // Call the save endpoint to mark onboarding complete
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 6,
          onboarding_status: 'completed',
          patch: {}
        })
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

  if (loading) {
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

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[#FF3B30]/10 rounded-2xl p-6 text-center">
          <p className="text-[17px] text-[#FF3B30] mb-4">{error}</p>
          <button
            onClick={loadScorecard}
            className="text-[#007AFF] font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!scorecard) {
    return null
  }

  const primeScore = scorecard.prime_score
  const primeConfidence = scorecard.prime_confidence
  const primeConfidenceDisplay = getConfidenceDisplay(primeConfidence)

  return (
    <div className="space-y-6">
      {/* Prime Score Header */}
      <div className="bg-gradient-to-br from-[#007AFF]/10 to-[#34C759]/10 rounded-2xl p-6 text-center">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#007AFF] to-[#34C759] flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-4xl font-bold text-white tabular-nums">
            {primeScore !== null ? Math.round(primeScore) : '—'}
          </span>
        </div>
        
        <h2 className="text-2xl font-bold text-black mb-1">Your Prime Score</h2>
        
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={`text-[15px] font-medium ${primeConfidenceDisplay.color}`}>
            {primeConfidenceDisplay.label} Confidence
          </span>
        </div>

        <p className="text-[13px] text-[#8E8E93]">
          {primeConfidenceDisplay.copy}
        </p>
      </div>

      {/* Domain Cards */}
      <div className="space-y-2">
        {PRIME_DOMAINS.map((domain) => (
          <DomainCard
            key={domain}
            domain={domain}
            scorecard={scorecard}
            expanded={expandedDomain === domain}
            onToggle={() => setExpandedDomain(expandedDomain === domain ? null : domain)}
          />
        ))}
      </div>

      {/* Success message */}
      <div className="text-center py-2">
        <p className="text-[17px] text-[#34C759] font-medium">
          ✓ Your scorecard is ready! Let&apos;s start your journey.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5EA]">
        <Link
          href="/onboarding/5"
          className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
        >
          Back
        </Link>

        <button
          onClick={handleComplete}
          disabled={completing}
          className="bg-[#34C759] text-white py-3 px-8 rounded-xl text-[17px] font-semibold hover:bg-[#2DB84D] active:bg-[#28A745] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {completing ? 'Starting...' : 'Go to Coach →'}
        </button>
      </div>

      {/* Scoring info */}
      <p className="text-[11px] text-[#8E8E93] text-center">
        Generated: {new Date(scorecard.generated_at).toLocaleDateString()} • v{scorecard.scoring_revision.slice(0, 5)}
      </p>
    </div>
  )
}

