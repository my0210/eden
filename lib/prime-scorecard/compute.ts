/**
 * Prime Scorecard Computation Engine
 * 
 * Deterministic computation of Prime Scorecard from inputs.
 * This is the core scoring logic.
 */

import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS, ScorecardEvidence, EvidenceSource } from './types'
import { emptyScorecard } from './contract'
import { validateScorecard } from './validate'
import { expectedMetricsByDomain, metricDisplay, MetricCode } from './metrics'
import { ScorecardInputs, MetricInput } from './inputs'
import { toContribution, ContributionResult } from './metricContribution'

// =============================================================================
// TYPES
// =============================================================================

type DomainScoreResult = {
  score: number | null
  confidence: number
  contributions: Array<{ metric_code: string; contribution: ContributionResult }>
  missing: string[]
  how_calculated: string[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Days after which data is considered completely stale */
const FRESHNESS_STALE_DAYS = 90

/** Days within which data is considered fully fresh */
const FRESHNESS_FRESH_DAYS = 7

/** Weight for coverage in confidence calculation */
const COVERAGE_WEIGHT = 0.7

/** Weight for freshness in confidence calculation */
const FRESHNESS_WEIGHT = 0.3

// =============================================================================
// MAIN COMPUTATION FUNCTION
// =============================================================================

/**
 * Compute a Prime Scorecard from inputs.
 * 
 * This function:
 * 1. Builds evidence array from all inputs (metrics, uploads, self-report)
 * 2. Computes domain scores from metric contributions
 * 3. Calculates confidence based on coverage and freshness
 * 4. Generates how_calculated explanations
 * 5. Validates output before returning
 * 
 * @param inputs - ScorecardInputs from loadScorecardInputs
 * @param nowIso - Current timestamp (ISO string) for consistency
 * @param scoringRevision - Version identifier for the scoring algorithm
 * @returns PrimeScorecard - validated scorecard object
 */
export function computePrimeScorecard(
  inputs: ScorecardInputs,
  nowIso: string,
  scoringRevision: string
): PrimeScorecard {
  // Start with empty scorecard
  const scorecard = emptyScorecard(nowIso, scoringRevision)

  // 1. Build evidence array
  scorecard.evidence = buildEvidence(inputs)

  // 2. Compute domain scores and confidence
  const domainResults: Record<PrimeDomain, DomainScoreResult> = {
    heart: computeDomainScore('heart', inputs, nowIso),
    frame: computeDomainScore('frame', inputs, nowIso),
    metabolism: computeDomainScore('metabolism', inputs, nowIso),
    recovery: computeDomainScore('recovery', inputs, nowIso),
    mind: computeDomainScore('mind', inputs, nowIso),
  }

  // 3. Fill domain scores and confidence
  for (const domain of PRIME_DOMAINS) {
    const result = domainResults[domain]
    scorecard.domain_scores[domain] = result.score
    scorecard.domain_confidence[domain] = result.confidence
    scorecard.how_calculated[domain] = result.how_calculated
  }

  // 4. Compute prime score (average of non-null domain scores)
  const nonNullDomainScores = PRIME_DOMAINS
    .map(d => scorecard.domain_scores[d])
    .filter((s): s is number => s !== null)

  if (nonNullDomainScores.length > 0) {
    scorecard.prime_score = Math.round(
      nonNullDomainScores.reduce((sum, s) => sum + s, 0) / nonNullDomainScores.length
    )
  }

  // 5. Compute prime confidence (average of all domain confidences)
  scorecard.prime_confidence = Math.round(
    PRIME_DOMAINS.reduce((sum, d) => sum + scorecard.domain_confidence[d], 0) / PRIME_DOMAINS.length
  )

  // 6. Validate before returning
  const validation = validateScorecard(scorecard)
  if (!validation.valid) {
    console.error('computePrimeScorecard: Invalid scorecard generated', validation.errors)
    // Return anyway - validation errors are logged but shouldn't crash
  }

  return scorecard
}

// =============================================================================
// EVIDENCE BUILDING
// =============================================================================

function buildEvidence(inputs: ScorecardInputs): ScorecardEvidence[] {
  const evidence: ScorecardEvidence[] = []

  // Add metric evidence
  for (const metric of inputs.metrics) {
    const display = metricDisplay[metric.metric_code as MetricCode]
    const domain = display?.domain

    if (domain) {
      evidence.push({
        domain,
        metric_code: metric.metric_code,
        source: metric.source,
        measured_at: metric.measured_at,
        value_raw: metric.value_raw,
        unit: metric.unit,
      })
    }
  }

  // Add Apple Health upload evidence (as note-only)
  if (inputs.uploads.apple_health) {
    const ah = inputs.uploads.apple_health
    evidence.push({
      domain: 'heart', // Associate with heart as primary domain for AH
      metric_code: 'apple_health_upload',
      source: 'apple_health',
      measured_at: ah.processed_at || ah.uploaded_at || inputs.loaded_at,
      note: `Apple Health: ${ah.status}${ah.processed_at ? ` (processed ${formatDate(ah.processed_at)})` : ''}`,
    })
  }

  // Add photo evidence (as note-only)
  if (inputs.uploads.photos.count > 0) {
    evidence.push({
      domain: 'frame', // Photos are associated with frame domain
      metric_code: 'photo_body',
      source: 'photo',
      measured_at: inputs.uploads.photos.latest_uploaded_at || inputs.loaded_at,
      note: `${inputs.uploads.photos.count} photo(s) uploaded`,
    })
  }

  // Add self-report essentials evidence (as note-only)
  const sr = inputs.self_report
  const selfReportParts: string[] = []
  
  if (sr.age !== undefined) selfReportParts.push(`Age: ${sr.age}`)
  else if (sr.dob) selfReportParts.push(`DOB: ${sr.dob}`)
  
  if (sr.sex_at_birth) selfReportParts.push(`Sex: ${sr.sex_at_birth}`)
  if (sr.height) selfReportParts.push(`Height: ${sr.height}${sr.units === 'imperial' ? 'in' : 'cm'}`)
  if (sr.weight) selfReportParts.push(`Weight: ${sr.weight}${sr.units === 'imperial' ? 'lbs' : 'kg'}`)

  if (selfReportParts.length > 0) {
    evidence.push({
      domain: 'frame', // Self-report essentials relate to frame/body
      metric_code: 'self_report_essentials',
      source: 'self_report',
      measured_at: inputs.loaded_at,
      note: `Self-reported: ${selfReportParts.join(', ')}`,
    })
  }

  return evidence
}

// =============================================================================
// DOMAIN SCORE COMPUTATION
// =============================================================================

function computeDomainScore(
  domain: PrimeDomain,
  inputs: ScorecardInputs,
  nowIso: string
): DomainScoreResult {
  const expectedMetrics = expectedMetricsByDomain[domain]
  const contributions: Array<{ metric_code: string; contribution: ContributionResult }> = []
  const missing: string[] = []
  const included: string[] = []

  // Get sex from self-report for body composition scoring
  const sex = inputs.self_report.sex_at_birth?.toLowerCase() as 'male' | 'female' | undefined

  // Try to compute contribution for each expected metric
  for (const metricCode of expectedMetrics) {
    const display = metricDisplay[metricCode]
    const metricInput = findMetricInput(inputs.metrics, metricCode)

    if (metricInput) {
      const result = toContribution(
        metricCode,
        metricInput.value_raw,
        metricInput.unit,
        sex
      )

      if (result) {
        contributions.push({ metric_code: metricCode, contribution: result })
        included.push(display?.label || metricCode)
      } else {
        // Has data but couldn't score (e.g., BP without diastolic)
        missing.push(`${display?.label || metricCode} (incomplete data)`)
      }
    } else {
      missing.push(display?.label || metricCode)
    }
  }

  // Compute domain score
  let score: number | null = null
  if (contributions.length > 0) {
    const avgContribution = contributions.reduce((sum, c) => sum + c.contribution.contribution, 0) / contributions.length
    score = Math.round(avgContribution)
  }

  // Compute confidence
  const coverage = contributions.length / expectedMetrics.length
  const freshness = computeFreshnessScore(contributions, inputs.metrics, nowIso)
  const confidence = Math.round(100 * (COVERAGE_WEIGHT * coverage + FRESHNESS_WEIGHT * (freshness / 100)))

  // Build how_calculated strings
  const how_calculated: string[] = []
  
  if (contributions.length > 0) {
    how_calculated.push(`Included: ${included.join(', ')}`)
    // Add contribution details
    for (const c of contributions) {
      how_calculated.push(`  • ${c.contribution.basis}`)
    }
  }
  
  if (missing.length > 0) {
    how_calculated.push(`Missing: ${missing.join(', ')}`)
  }
  
  if (contributions.length === 0) {
    how_calculated.push('No available metrics yet.')
  }

  return {
    score,
    confidence: contributions.length === 0 ? 0 : confidence,
    contributions,
    missing,
    how_calculated,
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Find a metric input by code, handling variations
 */
function findMetricInput(metrics: MetricInput[], metricCode: string): MetricInput | undefined {
  // Direct match
  let found = metrics.find(m => m.metric_code === metricCode)
  if (found) return found

  // Handle legacy code variations
  const legacyMappings: Record<string, string[]> = {
    'resting_hr': ['resting_hr_and_recovery'],
    'sleep': ['sleep_efficiency_and_duration'],
  }

  const alternatives = legacyMappings[metricCode]
  if (alternatives) {
    for (const alt of alternatives) {
      found = metrics.find(m => m.metric_code === alt)
      if (found) return found
    }
  }

  return undefined
}

/**
 * Compute freshness score (0-100) based on newest measurement
 */
function computeFreshnessScore(
  contributions: Array<{ metric_code: string; contribution: ContributionResult }>,
  metrics: MetricInput[],
  nowIso: string
): number {
  if (contributions.length === 0) return 0

  const now = new Date(nowIso).getTime()
  let newestMeasurement = 0

  for (const c of contributions) {
    const metric = metrics.find(m => 
      m.metric_code === c.metric_code || 
      m.metric_code === 'resting_hr_and_recovery' && c.metric_code === 'resting_hr' ||
      m.metric_code === 'sleep_efficiency_and_duration' && c.metric_code === 'sleep'
    )
    if (metric) {
      const measuredAt = new Date(metric.measured_at).getTime()
      if (measuredAt > newestMeasurement) {
        newestMeasurement = measuredAt
      }
    }
  }

  if (newestMeasurement === 0) return 0

  const daysOld = (now - newestMeasurement) / (1000 * 60 * 60 * 24)

  if (daysOld <= FRESHNESS_FRESH_DAYS) {
    return 100
  } else if (daysOld >= FRESHNESS_STALE_DAYS) {
    return 0
  } else {
    // Linear decay from 100 to 0 between FRESH_DAYS and STALE_DAYS
    const range = FRESHNESS_STALE_DAYS - FRESHNESS_FRESH_DAYS
    const decay = (daysOld - FRESHNESS_FRESH_DAYS) / range
    return Math.round(100 * (1 - decay))
  }
}

/**
 * Format a date for display
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return isoString
  }
}

