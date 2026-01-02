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
 * Short tooltip descriptions (≤120 chars) - shown in expanded card
 */
const domainTooltips: Record<PrimeDomain, string> = {
  heart: 'Cardio fitness + blood pressure. Stronger signals better long-term resilience and daily energy.',
  frame: 'Strength + body composition + resilience. Supports mobility, independence, and healthier aging.',
  metabolism: 'Blood markers tied to long-term risk. Labs make this most accurate; without labs it\'s estimated.',
  recovery: 'Sleep + readiness. Drives energy, consistency, and how well you adapt to stress and training.',
  mind: 'Focus + clarity. Sensitive to sleep and stress; confidence is higher with objective checks.',
}

/**
 * Full "Learn more" content for each domain
 */
const domainLearnMore: Record<PrimeDomain | 'prime', {
  title: string
  whatItIs: string
  whyItMatters: string
  whatImproves: string[]
  whatEdenUses: string[]
}> = {
  prime: {
    title: 'Prime Score',
    whatItIs: 'Your combined snapshot across the five Prime domains.',
    whyItMatters: 'It reflects how well your body is set up to perform today and stay resilient over time.',
    whatImproves: [
      'Improving any domain improves Prime',
      'Fastest gains usually come from fixing the biggest gap first',
    ],
    whatEdenUses: [
      'Measurements, uploaded data, and quick checks',
      'Confidence rises with objective, recent data',
    ],
  },
  heart: {
    title: 'Heart',
    whatItIs: 'Cardiovascular fitness and blood pressure.',
    whyItMatters: 'Heart fitness and healthy blood pressure are strongly linked to healthspan and lower long-term risk. They also affect daily energy and stamina.',
    whatImproves: [
      'Consistent aerobic activity (walking, cycling, zone-2 style work)',
      'Interval work if appropriate',
      'Blood pressure basics: sleep, sodium/potassium balance, weight management, stress',
    ],
    whatEdenUses: [
      'Blood pressure (best)',
      'Resting heart rate and cardio fitness estimates (when available)',
      'Self-reports only when measurements are missing (lower confidence)',
    ],
  },
  frame: {
    title: 'Frame',
    whatItIs: 'Strength, body composition, and physical resilience.',
    whyItMatters: 'Strength and lean mass support mobility and independence as you age. Body composition and fat distribution influence long-term risk and how you feel day to day.',
    whatImproves: [
      'Progressive strength training (especially legs, hips, back)',
      'Protein intake and recovery to support lean mass',
      'Reducing midsection fat through consistent activity + sleep + nutrition',
    ],
    whatEdenUses: [
      'Waist/height or waist estimate (midsection adiposity proxy)',
      'Body fat (measured or estimated) and derived lean mass range',
      'Strength proxies and any limitations you report',
      'Photo-based signals are estimates and won\'t be shown as exact numbers',
    ],
  },
  metabolism: {
    title: 'Metabolism',
    whatItIs: 'Your metabolic and inflammation status from key blood markers.',
    whyItMatters: 'Markers like ApoB (lipoproteins), HbA1c (glucose control), and hs-CRP (inflammation) are among the strongest predictors of long-term risk.',
    whatImproves: [
      'Nutrition quality and consistency (protein/fiber, fewer ultra-processed foods)',
      'Regular movement (especially after meals)',
      'Weight and waist reduction when needed',
      'Medication management when appropriate (in partnership with a clinician)',
    ],
    whatEdenUses: [
      'Labs: ApoB, HbA1c, hs-CRP (highest confidence)',
      'Without lab values, Eden shows an estimated risk with low confidence',
    ],
  },
  recovery: {
    title: 'Recovery',
    whatItIs: 'Sleep patterns and nervous system readiness.',
    whyItMatters: 'Recovery drives energy, mood, consistency, and how well your body adapts to training and stress.',
    whatImproves: [
      'Sleep duration and schedule regularity',
      'Better pre-sleep routine (light, caffeine, alcohol timing)',
      'Managing training load and stress',
    ],
    whatEdenUses: [
      'Sleep duration/regularity (and wearables when connected)',
      'HRV/resting HR trends when available',
      'Self-reports are used when device data is missing',
    ],
  },
  mind: {
    title: 'Mind',
    whatItIs: 'Focus, clarity, and cognitive readiness.',
    whyItMatters: 'Cognitive performance affects work and decision-making and is highly sensitive to sleep, stress, and workload.',
    whatImproves: [
      'Sleep regularity and adequate duration',
      'Better workload pacing and breaks',
      'Caffeine timing and stress management',
    ],
    whatEdenUses: [
      'Short focus checks (if enabled) and self-reports',
      'Confidence is higher with objective checks and repeated baselines',
    ],
  },
}

/**
 * Upgrade action suggestions by domain
 */
const upgradeActions: Record<PrimeDomain, string> = {
  heart: 'Connect Apple Health or add blood pressure',
  frame: 'Add waist measurement or body photo',
  metabolism: 'Add recent lab results (ApoB, HbA1c)',
  recovery: 'Connect a sleep tracker',
  mind: 'Focus Check coming soon',
}

/**
 * Get confidence display info from 0-100 confidence value
 */
function getConfidenceDisplay(confidence: number): { 
  label: 'Low' | 'Medium' | 'High'
  color: string 
  bgColor: string
} {
  if (confidence < 40) {
    return {
      label: 'Low',
      color: 'text-[#FF9500]',
      bgColor: 'bg-[#FF9500]/10',
    }
  }
  if (confidence < 70) {
    return {
      label: 'Medium',
      color: 'text-[#007AFF]',
      bgColor: 'bg-[#007AFF]/10',
    }
  }
  return {
    label: 'High',
    color: 'text-[#34C759]',
    bgColor: 'bg-[#34C759]/10',
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
 * Get newest evidence timestamp for a domain
 */
function getDomainLatestTimestamp(scorecard: PrimeScorecard, domain: PrimeDomain): string | null {
  let newest: string | null = null
  for (const e of scorecard.evidence) {
    if (e.domain === domain && e.measured_at && e.value_raw !== undefined) {
      if (!newest || e.measured_at > newest) {
        newest = e.measured_at
      }
    }
  }
  return newest
}

/**
 * Format date compactly for inline display
 */
function formatDateCompact(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Learn More Modal/Bottom Sheet
 */
function LearnMoreModal({ 
  domain, 
  onClose 
}: { 
  domain: PrimeDomain | 'prime'
  onClose: () => void 
}) {
  const content = domainLearnMore[domain]
  const display = domain === 'prime' ? null : domainDisplay[domain]
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-[#E5E5EA] rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-5 pb-4 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-3">
            {display && (
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${display.color}20` }}
              >
                <span className="text-xl">{display.icon}</span>
              </div>
            )}
            <h2 className="text-[20px] font-bold text-black">{content.title}</h2>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* What it is */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
              What it is
            </h3>
            <p className="text-[15px] text-[#3C3C43] leading-relaxed">
              {content.whatItIs}
            </p>
          </div>
          
          {/* Why it matters */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
              Why it matters
            </h3>
            <p className="text-[15px] text-[#3C3C43] leading-relaxed">
              {content.whyItMatters}
            </p>
          </div>
          
          {/* What improves it */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              What improves it
            </h3>
            <ul className="space-y-1.5">
              {content.whatImproves.map((item, idx) => (
                <li key={idx} className="text-[15px] text-[#3C3C43] flex gap-2">
                  <span className="text-[#34C759]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* What Eden uses */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              What Eden uses
            </h3>
            <ul className="space-y-1.5">
              {content.whatEdenUses.map((item, idx) => (
                <li key={idx} className="text-[15px] text-[#3C3C43] flex gap-2">
                  <span className="text-[#007AFF]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Confidence footer */}
          <div className="pt-4 border-t border-[#E5E5EA]">
            <p className="text-[13px] text-[#8E8E93] leading-relaxed">
              <span className="font-medium">Confidence</span> reflects how much objective evidence we have and how recent it is. Higher confidence means less guesswork.
            </p>
          </div>
        </div>
        
        {/* Close button */}
        <div className="px-5 pb-8 pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#F2F2F7] rounded-xl text-[17px] font-semibold text-[#007AFF] active:bg-[#E5E5EA] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
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
  onToggle,
  onLearnMore
}: { 
  domain: PrimeDomain
  scorecard: PrimeScorecard
  showHowCalculated?: boolean
  expanded: boolean
  onToggle: () => void
  onLearnMore: () => void
}) {
  const display = domainDisplay[domain]
  const score = scorecard.domain_scores[domain]
  const confidence = scorecard.domain_confidence[domain]
  const confidenceDisplay = getConfidenceDisplay(confidence)
  const howCalculated = scorecard.how_calculated[domain]
  const latestTimestamp = getDomainLatestTimestamp(scorecard, domain)

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
            <span className="text-[17px] font-semibold text-black">{display.label}</span>
            <div className="flex items-center gap-2">
              <span className={`text-[13px] ${confidenceDisplay.color}`}>
                {Math.round(confidence)}% confidence
              </span>
              {latestTimestamp && (
                <span className="text-[11px] text-[#8E8E93]">
                  • {formatDateCompact(latestTimestamp)}
                </span>
              )}
            </div>
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

      {/* Expanded content */}
      {showHowCalculated && expanded && (
        <div className="px-4 py-3 bg-[#F2F2F7] border-t border-[#E5E5EA] space-y-3">
          {/* Short tooltip description */}
          <p className="text-[14px] text-[#3C3C43] leading-snug">
            {domainTooltips[domain]}
          </p>

          {/* Your data section */}
          {howCalculated.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#E5E5EA]">
              <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">
                Your data
              </p>
              {howCalculated.map((line, idx) => {
                const evidence = scorecard.evidence.find(e => 
                  e.domain === domain && 
                  line.toLowerCase().includes(e.metric_code.replace(/_/g, ' '))
                )
                const date = evidence?.measured_at ? formatDateCompact(evidence.measured_at) : null
                
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <p className="text-[13px] text-[#3C3C43] flex-1">
                      {line}
                    </p>
                    {date && (
                      <span className="text-[11px] text-[#8E8E93] ml-2 flex-shrink-0">
                        {date}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Upgrade action + Learn more */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E5E5EA]">
            {confidenceDisplay.label !== 'High' ? (
              <p className="text-[13px] text-[#007AFF]">
                → {upgradeActions[domain]}
              </p>
            ) : (
              <div />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onLearnMore(); }}
              className="text-[13px] text-[#8E8E93] hover:text-[#007AFF] transition-colors"
            >
              Learn more
            </button>
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
  const [learnMoreDomain, setLearnMoreDomain] = useState<PrimeDomain | 'prime' | null>(null)
  
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
        
        {/* Tooltip description for Prime */}
        {!compact && (
          <p className="text-[14px] text-[#3C3C43] mb-2 max-w-xs mx-auto">
            Overall readiness across Heart, Frame, Metabolism, Recovery, and Mind.
          </p>
        )}
        
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={`text-[15px] font-medium ${primeConfidenceDisplay.color}`}>
            {Math.round(primeConfidence)}% confidence
          </span>
          {!compact && (
            <button
              onClick={() => setLearnMoreDomain('prime')}
              className="text-[13px] text-[#8E8E93] hover:text-[#007AFF] transition-colors underline"
            >
              Learn more
            </button>
          )}
        </div>

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
            onLearnMore={() => setLearnMoreDomain(domain)}
          />
        ))}
      </div>

      {/* Scoring Revision (debug) */}
      {!compact && (
        <p className="text-[11px] text-[#8E8E93] text-center">
          Generated: {formatTimestamp(scorecard.generated_at)} • Rev: {scorecard.scoring_revision.slice(0, 7)}
        </p>
      )}

      {/* Learn More Modal */}
      {learnMoreDomain && (
        <LearnMoreModal 
          domain={learnMoreDomain} 
          onClose={() => setLearnMoreDomain(null)} 
        />
      )}
    </div>
  )
}
