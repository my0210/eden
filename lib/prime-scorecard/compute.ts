/**
 * Prime Scorecard Computation Engine
 * 
 * Deterministic computation of Prime Scorecard from inputs.
 * This is the core scoring logic.
 * 
 * v3: Now integrates with the new config-driven scoring engine when
 * prime_check_json data is present (onboarding v3 flow).
 */

import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS, ScorecardEvidence, EvidenceSource } from './types'
import { emptyScorecard } from './contract'
import { validateScorecard } from './validate'
import { expectedMetricsByDomain, metricDisplay, MetricCode } from './metrics'
import { ScorecardInputs, MetricInput, PrimeCheckJson } from './inputs'
import { toContribution, ContributionResult } from './metricContribution'
import { computeScorecard as computeScorecardV3, Observation, SourceType } from './scoring'
import { convertPrimeCheckToObservations } from './scoring/prime-check-converter'

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
 * 1. Checks if prime_check_json is present (onboarding v3)
 *    - If so, uses the new config-driven scoring engine
 * 2. Otherwise, uses the legacy scoring approach:
 *    a. Builds evidence array from all inputs (metrics, uploads, self-report)
 *    b. Computes domain scores from metric contributions
 *    c. Calculates confidence based on coverage and freshness
 *    d. Generates how_calculated explanations
 * 3. Validates output before returning
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
  // Use new scoring engine if prime_check_json is present
  if (inputs.prime_check && inputs.prime_check.schema_version) {
    return computeScorecardV3Flow(inputs, nowIso, scoringRevision)
  }

  // Legacy scoring flow for users without prime_check_json
  return computeLegacyScorecard(inputs, nowIso, scoringRevision)
}

/**
 * Compute scorecard using the new v3 scoring engine
 */
function computeScorecardV3Flow(
  inputs: ScorecardInputs,
  nowIso: string,
  scoringRevision: string
): PrimeScorecard {
  const now = new Date(nowIso)
  
  // Convert prime_check_json to observations
  const primeCheckObservations = convertPrimeCheckToObservations(
    inputs.prime_check as PrimeCheckJson,
    {
      height: inputs.self_report.height,
      weight: inputs.self_report.weight,
      age: inputs.self_report.age,
      sex: inputs.self_report.sex_at_birth,
    }
  )

  // Convert Apple Health metrics to observations
  const metricObservations = convertMetricsToObservations(inputs.metrics)

  // Merge observations (device data takes priority)
  const allObservations = [...primeCheckObservations, ...metricObservations]

  // Compute scorecard using new engine
  const v3Result = computeScorecardV3(
    allObservations,
    {
      age: inputs.self_report.age,
      sex: inputs.self_report.sex_at_birth,
    },
    now
  )

  // Convert v3 result to PrimeScorecard format
  const scorecard = emptyScorecard(nowIso, scoringRevision)

  // Fill in scores (always present in v3)
  scorecard.prime_score = Math.round(v3Result.prime_score)
  scorecard.prime_confidence = v3Result.prime_confidence

  for (const domain of PRIME_DOMAINS) {
    const domainResult = v3Result.domain_results[domain]
    scorecard.domain_scores[domain] = Math.round(domainResult.domain_score)
    scorecard.domain_confidence[domain] = domainResult.domain_confidence
    scorecard.how_calculated[domain] = v3Result.how_calculated[domain]
  }

  // Build evidence array from v3 results
  scorecard.evidence = buildEvidenceFromV3(v3Result, inputs)

  // Validate before returning
  const validation = validateScorecard(scorecard)
  if (!validation.valid) {
    console.error('computePrimeScorecard (v3): Invalid scorecard generated', validation.errors)
  }

  return scorecard
}

/**
 * Convert metrics from eden_metric_values to Observations
 */
function convertMetricsToObservations(metrics: MetricInput[]): Observation[] {
  const observations: Observation[] = []

  for (const metric of metrics) {
    // Map metric_code to driver_key
    const driverKey = mapMetricCodeToDriver(metric.metric_code)
    if (!driverKey) continue

    observations.push({
      driver_key: driverKey,
      value: metric.value_raw,
      unit: metric.unit,
      measured_at: metric.measured_at,
      source_type: mapSourceToSourceType(metric.source),
      metadata: {
        source_batch_id: metric.import_id,
        original_metric_code: metric.metric_code,
      },
    })
  }

  return observations
}

/**
 * Map metric_code to driver_key
 */
function mapMetricCodeToDriver(metricCode: string): string | null {
  const mapping: Record<string, string> = {
    'resting_heart_rate': 'rhr',
    'resting_hr': 'rhr',
    'resting_hr_and_recovery': 'rhr',
    'hrv': 'hrv',
    'heart_rate_variability': 'hrv',
    'blood_pressure': 'bp',
    'bp_systolic': 'bp',
    'vo2max': 'cardio_fitness',
    'weight': 'bmi', // Will need height to calculate
    'body_mass': 'bmi',
    'sleep': 'sleep_duration',
    'sleep_efficiency_and_duration': 'sleep_duration',
    'sleep_duration': 'sleep_duration',
  }

  return mapping[metricCode] || null
}

/**
 * Map evidence source to source type
 */
function mapSourceToSourceType(source: EvidenceSource): SourceType {
  switch (source) {
    case 'apple_health':
      return 'device'
    case 'photo':
      return 'measured_self_report'
    case 'self_report':
      return 'self_report_proxy'
    default:
      return 'self_report_proxy'
  }
}

/**
 * Build evidence array from v3 results
 */
function buildEvidenceFromV3(
  v3Result: ReturnType<typeof computeScorecardV3>,
  inputs: ScorecardInputs
): ScorecardEvidence[] {
  const evidence: ScorecardEvidence[] = []

  for (const domain of PRIME_DOMAINS) {
    const domainResult = v3Result.domain_results[domain]
    
    for (const driverResult of domainResult.driver_results) {
      evidence.push({
        domain,
        metric_code: driverResult.driver_key,
        source: mapSourceTypeToSource(driverResult.source_type),
        measured_at: driverResult.measured_at,
        value_raw: driverResult.value,
        unit: driverResult.unit,
        subscore: driverResult.driver_score,
      })
    }
  }

  return evidence
}

/**
 * Map source type back to evidence source
 */
function mapSourceTypeToSource(sourceType: SourceType): EvidenceSource {
  switch (sourceType) {
    case 'device':
      return 'apple_health'
    case 'lab':
    case 'test':
      return 'self_report' // We don't have a "lab" evidence source
    case 'measured_self_report':
    case 'self_report_proxy':
    case 'prior':
    default:
      return 'self_report'
  }
}

/**
 * Legacy computation function (for users without prime_check_json)
 */
function computeLegacyScorecard(
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
    
    // Update evidence items with their subscores
    for (const { metric_code, contribution } of result.contributions) {
      const evidenceItem = scorecard.evidence.find(
        e => e.domain === domain && e.metric_code === metric_code
      )
      if (evidenceItem) {
        evidenceItem.subscore = contribution.contribution
      }
    }
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
        source_batch_id: metric.import_id, // PR9D: Track which import this came from
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

