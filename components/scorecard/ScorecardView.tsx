'use client'

import { useState } from 'react'
import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types'
import { domainDisplay } from '@/lib/prime-scorecard/metrics'

interface ScorecardViewProps {
  scorecard: PrimeScorecard
  showHowCalculated?: boolean
  compact?: boolean
}

/**
 * Get confidence label from 0-100 confidence value
 */
function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 80) return { label: 'High', color: 'text-[#34C759]' }
  if (confidence >= 50) return { label: 'Medium', color: 'text-[#FF9500]' }
  if (confidence >= 20) return { label: 'Low', color: 'text-[#FF3B30]' }
  return { label: 'Very Low', color: 'text-[#8E8E93]' }
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
 * Get freshest timestamp from evidence
 */
function getFreshestTimestamp(scorecard: PrimeScorecard): string | null {
  let freshest: string | null = null
  for (const e of scorecard.evidence) {
    if (e.measured_at && e.value_raw !== undefined && (!freshest || e.measured_at > freshest)) {
      freshest = e.measured_at
    }
  }
  return freshest
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  } catch {
    return 'Unknown'
  }
}

/**
 * Count contributing drivers for a domain
 */
function countContributingDrivers(scorecard: PrimeScorecard, domain: PrimeDomain): number {
  const domainEvidence = scorecard.evidence.filter(
    e => e.domain === domain && e.value_raw !== undefined && e.subscore !== undefined
  )
  // Count unique driver keys that have actual values
  return new Set(domainEvidence.map(e => e.metric_code)).size
}

/**
 * Domain Card Component
 */
function DomainCard({ 
  domain, 
  scorecard, 
  showHowCalculated,
  expanded,
  onToggle 
}: { 
  domain: PrimeDomain
  scorecard: PrimeScorecard
  showHowCalculated?: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const display = domainDisplay[domain]
  const score = scorecard.domain_scores[domain]
  const confidence = scorecard.domain_confidence[domain]
  const confidenceInfo = getConfidenceLabel(confidence)
  const howCalculated = scorecard.how_calculated[domain]
  const contributing = countContributingDrivers(scorecard, domain)

  return (
    <div className="bg-white rounded-xl border border-[#E5E5EA] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F2F2F7]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{display.icon}</span>
          <div className="text-left">
            <span className="text-[17px] font-semibold text-black block">{display.label}</span>
            <span className="text-[13px] text-[#8E8E93]">
              {contributing} driver{contributing !== 1 ? 's' : ''} • {confidenceInfo.label} confidence
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[28px] font-bold tabular-nums ${getScoreColor(score)}`}>
            {score !== null ? score : '—'}
          </span>
          {showHowCalculated && (
            <svg 
              className={`w-5 h-5 text-[#8E8E93] transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* How Calculated Drawer */}
      {showHowCalculated && expanded && howCalculated.length > 0 && (
        <div className="px-4 py-3 bg-[#F2F2F7] border-t border-[#E5E5EA]">
          <div className="space-y-1">
            {howCalculated.map((line, idx) => (
              <p key={idx} className="text-[13px] text-[#3C3C43]">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Main Scorecard View Component
 */
export default function ScorecardView({ 
  scorecard, 
  showHowCalculated = true,
  compact = false 
}: ScorecardViewProps) {
  const [expandedDomain, setExpandedDomain] = useState<PrimeDomain | null>(null)
  
  const primeScore = scorecard.prime_score
  const primeConfidence = scorecard.prime_confidence
  const primeConfidenceInfo = getConfidenceLabel(primeConfidence)
  const freshestTimestamp = getFreshestTimestamp(scorecard)

  // Count total contributing drivers
  const totalContributing = PRIME_DOMAINS.reduce((sum, d) => {
    return sum + countContributingDrivers(scorecard, d)
  }, 0)

  return (
    <div className="space-y-4">
      {/* Prime Score Header */}
      <div className={`bg-gradient-to-br from-[#007AFF]/10 to-[#34C759]/10 rounded-2xl ${compact ? 'p-4' : 'p-6'} text-center`}>
        <div className={`${compact ? 'w-20 h-20' : 'w-28 h-28'} rounded-full bg-gradient-to-br from-[#007AFF] to-[#34C759] flex items-center justify-center mx-auto mb-4`}>
          <span className={`${compact ? 'text-3xl' : 'text-4xl'} font-bold text-white tabular-nums`}>
            {primeScore !== null ? primeScore : '—'}
          </span>
        </div>
        
        <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-black mb-1`}>Prime Score</h2>
        
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className={`text-[15px] font-medium ${primeConfidenceInfo.color}`}>
            {primeConfidenceInfo.label} Confidence ({primeConfidence}%)
          </span>
        </div>

        <div className="text-[13px] text-[#8E8E93] space-y-1">
          <p>Based on {totalContributing} driver{totalContributing !== 1 ? 's' : ''}</p>
          {freshestTimestamp && (
            <p>Latest data: {formatTimestamp(freshestTimestamp)}</p>
          )}
        </div>

        {primeScore === null && (
          <div className="mt-4 p-3 bg-[#FF9500]/10 rounded-xl">
            <p className="text-[14px] text-[#C85D00]">
              📊 Upload Apple Health data to generate a confident scorecard
            </p>
          </div>
        )}
      </div>

      {/* Domain Cards */}
      <div className="space-y-2">
        {PRIME_DOMAINS.map((domain) => (
          <DomainCard
            key={domain}
            domain={domain}
            scorecard={scorecard}
            showHowCalculated={showHowCalculated}
            expanded={expandedDomain === domain}
            onToggle={() => setExpandedDomain(expandedDomain === domain ? null : domain)}
          />
        ))}
      </div>

      {/* Scoring Revision (debug) */}
      {!compact && (
        <p className="text-[11px] text-[#8E8E93] text-center">
          Generated: {formatTimestamp(scorecard.generated_at)} • Rev: {scorecard.scoring_revision.slice(0, 7)}
        </p>
      )}
    </div>
  )
}

