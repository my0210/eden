/**
 * Smart Domain Selection
 * 
 * Selects priority domains for coaching based on:
 * - Confidence-aware scoring (prefer high-confidence domains)
 * - Synergy between domains
 * - User's available time budget
 * - Actionability (do we have data to help?)
 */

import { PrimeDomain, PrimeScorecard, PRIME_DOMAINS } from '@/lib/prime-scorecard/types'

// ============================================================================
// Types
// ============================================================================

export interface DomainSelection {
  primary: PrimeDomain
  secondary: PrimeDomain | null
  tertiary: PrimeDomain | null
  reasoning: {
    primary: string
    secondary: string | null
    tertiary: string | null
  }
}

export interface SelectionContext {
  scorecard: PrimeScorecard
  timeBudgetHoursPerWeek: number
  userPreferences?: PrimeDomain[] // domains user is interested in
  excludeDomains?: PrimeDomain[] // domains to skip (e.g., user explicitly declined)
}

// ============================================================================
// Domain Synergy Matrix
// ============================================================================

/**
 * Synergy matrix: which secondary domain best complements the primary
 * Based on physiological and behavioral interactions
 */
const DOMAIN_SYNERGY: Record<PrimeDomain, { best: PrimeDomain; rationale: string }> = {
  heart: {
    best: 'recovery',
    rationale: 'Better sleep improves cardio adaptation and HRV',
  },
  frame: {
    best: 'heart',
    rationale: 'Strength + cardio creates complete fitness foundation',
  },
  metabolism: {
    best: 'recovery',
    rationale: 'Sleep regulates glucose, appetite hormones, and metabolic rate',
  },
  recovery: {
    best: 'mind',
    rationale: 'Sleep and stress management compound each other',
  },
  mind: {
    best: 'recovery',
    rationale: 'Cognitive function depends on sleep quality',
  },
}

// ============================================================================
// Confidence Thresholds
// ============================================================================

const MIN_CONFIDENCE_FOR_PRIMARY = 60 // Must have decent data to be primary
const MIN_CONFIDENCE_FOR_SECONDARY = 40 // Can be secondary with less data
const MIN_RECOVERY_SCORE_FOR_TERTIARY = 60 // Need good recovery to handle 3 domains
const MIN_TIME_BUDGET_FOR_TERTIARY = 5 // Hours per week

// ============================================================================
// Main Selection Function
// ============================================================================

/**
 * Select priority domains based on scorecard and context
 */
export function selectPriorityDomains(context: SelectionContext): DomainSelection {
  const { scorecard, timeBudgetHoursPerWeek, userPreferences, excludeDomains } = context

  // Get eligible domains (not excluded)
  const eligibleDomains = PRIME_DOMAINS.filter(
    d => !excludeDomains?.includes(d)
  )

  // Score each domain for selection priority
  const scoredDomains = eligibleDomains.map(domain => ({
    domain,
    score: scorecard.domain_scores[domain],
    confidence: scorecard.domain_confidence[domain],
    isActionable: isDomainActionable(domain, scorecard),
    isPreferred: userPreferences?.includes(domain) ?? false,
  }))

  // Select primary: lowest score among high-confidence, actionable domains
  const primaryCandidates = scoredDomains
    .filter(d => d.confidence >= MIN_CONFIDENCE_FOR_PRIMARY && d.isActionable)
    .sort((a, b) => {
      // Prefer lower scores (more room for improvement)
      const scoreDiff = (a.score ?? 100) - (b.score ?? 100)
      if (scoreDiff !== 0) return scoreDiff
      // Tie-breaker: prefer user preferences
      if (a.isPreferred && !b.isPreferred) return -1
      if (!a.isPreferred && b.isPreferred) return 1
      // Tie-breaker: prefer higher confidence
      return b.confidence - a.confidence
    })

  // If no high-confidence domains, fall back to any actionable domain
  const primary = primaryCandidates[0]?.domain
    ?? scoredDomains.filter(d => d.isActionable).sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0]?.domain
    ?? 'recovery' // Ultimate fallback

  const primaryReasoning = buildPrimaryReasoning(primary, scoredDomains, scorecard)

  // Select secondary: synergistic domain
  const synergy = DOMAIN_SYNERGY[primary]
  const secondaryCandidates = scoredDomains
    .filter(d => 
      d.domain !== primary &&
      d.confidence >= MIN_CONFIDENCE_FOR_SECONDARY &&
      d.isActionable
    )
    .sort((a, b) => {
      // Prefer synergistic domain
      if (a.domain === synergy.best && b.domain !== synergy.best) return -1
      if (a.domain !== synergy.best && b.domain === synergy.best) return 1
      // Then prefer user preferences
      if (a.isPreferred && !b.isPreferred) return -1
      if (!a.isPreferred && b.isPreferred) return 1
      // Then prefer lower scores
      return (a.score ?? 100) - (b.score ?? 100)
    })

  const secondary = secondaryCandidates[0]?.domain ?? null
  const secondaryReasoning = secondary
    ? buildSecondaryReasoning(secondary, primary, synergy, scoredDomains)
    : null

  // Select tertiary: only if user has time AND good recovery
  let tertiary: PrimeDomain | null = null
  let tertiaryReasoning: string | null = null

  const recoveryScore = scorecard.domain_scores.recovery ?? 0
  const canHandleTertiary = 
    timeBudgetHoursPerWeek >= MIN_TIME_BUDGET_FOR_TERTIARY &&
    recoveryScore >= MIN_RECOVERY_SCORE_FOR_TERTIARY

  if (canHandleTertiary) {
    const tertiaryCandidates = scoredDomains
      .filter(d => 
        d.domain !== primary &&
        d.domain !== secondary &&
        d.isActionable
      )
      .sort((a, b) => {
        // Prefer user preferences
        if (a.isPreferred && !b.isPreferred) return -1
        if (!a.isPreferred && b.isPreferred) return 1
        // Then prefer lower scores
        return (a.score ?? 100) - (b.score ?? 100)
      })

    tertiary = tertiaryCandidates[0]?.domain ?? null
    tertiaryReasoning = tertiary
      ? `With ${timeBudgetHoursPerWeek}+ hours/week and good recovery (${recoveryScore}), you can handle a third focus on ${tertiary}.`
      : null
  }

  return {
    primary,
    secondary,
    tertiary,
    reasoning: {
      primary: primaryReasoning,
      secondary: secondaryReasoning,
      tertiary: tertiaryReasoning,
    },
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a domain is actionable (we have enough data to help)
 */
function isDomainActionable(domain: PrimeDomain, scorecard: PrimeScorecard): boolean {
  const domainEvidence = scorecard.evidence.filter(e => e.domain === domain)
  
  // Domain is actionable if we have at least some evidence
  // OR it's a domain where we can help without much data (like recovery/mind)
  if (domainEvidence.length > 0) return true
  
  // Recovery and Mind can be coached with minimal data
  if (domain === 'recovery' || domain === 'mind') return true
  
  // Heart needs some cardio data to personalize
  // Frame needs some body composition data
  // Metabolism needs labs or glucose data to be truly helpful
  return false
}

/**
 * Build reasoning for primary domain selection
 */
function buildPrimaryReasoning(
  primary: PrimeDomain,
  scoredDomains: Array<{ domain: PrimeDomain; score: number | null; confidence: number }>,
  scorecard: PrimeScorecard
): string {
  const domainInfo = scoredDomains.find(d => d.domain === primary)
  if (!domainInfo) return `${primary} selected as primary focus.`

  const score = domainInfo.score
  const confidence = domainInfo.confidence

  if (score === null) {
    return `${capitalize(primary)} selected as primary focus - we'll establish your baseline.`
  }

  if (confidence >= MIN_CONFIDENCE_FOR_PRIMARY) {
    return `${capitalize(primary)} is your lowest high-confidence domain (score: ${score}, confidence: ${confidence}%) - most room for improvement with reliable data.`
  }

  return `${capitalize(primary)} selected as primary focus (score: ${score}) - this is where you'll see the biggest gains.`
}

/**
 * Build reasoning for secondary domain selection
 */
function buildSecondaryReasoning(
  secondary: PrimeDomain,
  primary: PrimeDomain,
  synergy: { best: PrimeDomain; rationale: string },
  scoredDomains: Array<{ domain: PrimeDomain; score: number | null; confidence: number }>
): string {
  const isSynergistic = secondary === synergy.best

  if (isSynergistic) {
    return `${capitalize(secondary)} pairs well with ${primary}: ${synergy.rationale.toLowerCase()}`
  }

  const domainInfo = scoredDomains.find(d => d.domain === secondary)
  if (domainInfo?.score !== null) {
    return `${capitalize(secondary)} as secondary focus (score: ${domainInfo.score}) - will compound your ${primary} progress.`
  }

  return `${capitalize(secondary)} as secondary focus to support your ${primary} work.`
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ============================================================================
// Preview Helpers (for UI)
// ============================================================================

/**
 * Get a 1-line preview of what a domain protocol focuses on
 */
export function getDomainPreview(domain: PrimeDomain): string {
  const previews: Record<PrimeDomain, string> = {
    heart: 'Zone 2 cardio progression for VO2max',
    frame: 'Progressive strength and mobility',
    metabolism: 'Blood sugar stability and metabolic flexibility',
    recovery: 'Sleep optimization and HRV improvement',
    mind: 'Focus training and cognitive load management',
  }
  return previews[domain]
}

/**
 * Get all domain previews with selection info
 */
export function getSelectionSummary(selection: DomainSelection): Array<{
  domain: PrimeDomain
  priority: 'primary' | 'secondary' | 'tertiary'
  preview: string
  reasoning: string
}> {
  const result = []

  result.push({
    domain: selection.primary,
    priority: 'primary' as const,
    preview: getDomainPreview(selection.primary),
    reasoning: selection.reasoning.primary,
  })

  if (selection.secondary) {
    result.push({
      domain: selection.secondary,
      priority: 'secondary' as const,
      preview: getDomainPreview(selection.secondary),
      reasoning: selection.reasoning.secondary!,
    })
  }

  if (selection.tertiary) {
    result.push({
      domain: selection.tertiary,
      priority: 'tertiary' as const,
      preview: getDomainPreview(selection.tertiary),
      reasoning: selection.reasoning.tertiary!,
    })
  }

  return result
}

