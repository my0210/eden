'use client'

import { useState } from 'react'
import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types'

interface ScorecardViewProps {
  scorecard: PrimeScorecard
  showHowCalculated?: boolean
  compact?: boolean
}

/**
 * Domain display info with emoji icons and colors
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
 * Get confidence display info from 0-100 confidence value
 * Uses onboarding thresholds: < 40 = Low, < 70 = Medium, else High
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
              {confidenceDisplay.label} confidence ({confidence}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[28px] font-bold tabular-nums ${getScoreColor(score)}`}>
            {score !== null ? Math.round(score) : '—'}
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

      {/* Expanded content with structured sections */}
      {showHowCalculated && expanded && (
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
  const primeConfidenceDisplay = getConfidenceDisplay(primeConfidence)
  const freshestTimestamp = getFreshestTimestamp(scorecard)

  return (
    <div className="space-y-4">
      {/* Prime Score Header */}
      <div className={`bg-gradient-to-br from-[#007AFF]/10 to-[#34C759]/10 rounded-2xl ${compact ? 'p-4' : 'p-6'} text-center`}>
        <div className={`${compact ? 'w-20 h-20' : 'w-28 h-28'} rounded-full bg-gradient-to-br from-[#007AFF] to-[#34C759] flex items-center justify-center mx-auto mb-4 shadow-lg`}>
          <span className={`${compact ? 'text-3xl' : 'text-4xl'} font-bold text-white tabular-nums`}>
            {primeScore !== null ? Math.round(primeScore) : '—'}
          </span>
        </div>
        
        <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-black mb-1`}>
          {compact ? 'Prime Score' : 'Your Prime Score'}
        </h2>
        
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={`text-[15px] font-medium ${primeConfidenceDisplay.color}`}>
            {primeConfidenceDisplay.label} Confidence ({primeConfidence}%)
          </span>
        </div>

        <p className="text-[13px] text-[#8E8E93]">
          {primeConfidenceDisplay.copy}
        </p>

        {/* Show latest data timestamp if available */}
        {freshestTimestamp && !compact && (
          <p className="text-[12px] text-[#8E8E93] mt-2">
            Latest data: {formatTimestamp(freshestTimestamp)}
          </p>
        )}

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
