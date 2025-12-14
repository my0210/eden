/**
 * Prime Scorecard Computation Fixtures
 * 
 * Deterministic test fixtures to verify scorecard computation behavior.
 * These fixtures ensure:
 * - Null handling works correctly
 * - Score calculation is deterministic
 * - Confidence calculation is correct
 * - Validation passes for all outputs
 */

import { ScorecardInputs } from '../inputs'
import { computePrimeScorecard } from '../compute'
import { validateScorecard } from '../validate'

// Fixed timestamp for deterministic tests
const NOW_ISO = '2024-12-14T12:00:00.000Z'
const SCORING_REVISION = 'test-fixtures-v1'

// =============================================================================
// FIXTURE 1: Empty inputs (self-report only)
// =============================================================================

export const fixture1_emptyInputs: ScorecardInputs = {
  metrics: [],
  uploads: {
    apple_health: undefined,
    photos: { count: 0 },
  },
  self_report: {
    age: 35,
    sex_at_birth: 'male',
    height: 180,
    weight: 80,
    units: 'metric',
  },
  loaded_at: NOW_ISO,
}

/**
 * Expected: All domain scores null, all confidence 0, prime score null
 */
export function testFixture1() {
  const scorecard = computePrimeScorecard(fixture1_emptyInputs, NOW_ISO, SCORING_REVISION)
  
  const validation = validateScorecard(scorecard)
  console.log('Fixture 1 - Empty inputs:')
  console.log('  Valid:', validation.valid)
  console.log('  Prime score:', scorecard.prime_score)
  console.log('  Prime confidence:', scorecard.prime_confidence)
  console.log('  Domain scores:', scorecard.domain_scores)
  console.log('  Domain confidence:', scorecard.domain_confidence)
  
  // Assertions
  const pass = 
    validation.valid &&
    scorecard.prime_score === null &&
    scorecard.prime_confidence === 0 &&
    scorecard.domain_scores.heart === null &&
    scorecard.domain_scores.frame === null &&
    scorecard.domain_scores.metabolism === null &&
    scorecard.domain_scores.recovery === null &&
    scorecard.domain_scores.mind === null &&
    scorecard.domain_confidence.heart === 0 &&
    scorecard.domain_confidence.frame === 0 &&
    scorecard.domain_confidence.metabolism === 0 &&
    scorecard.domain_confidence.recovery === 0 &&
    scorecard.domain_confidence.mind === 0

  console.log('  PASS:', pass)
  return pass
}

// =============================================================================
// FIXTURE 2: Heart-only metrics (fresh data)
// =============================================================================

// Fresh date (within 7 days)
const FRESH_DATE = '2024-12-10T08:00:00.000Z'

export const fixture2_heartOnlyFresh: ScorecardInputs = {
  metrics: [
    {
      metric_code: 'vo2max',
      value_raw: 45, // Good: 40-49 → contribution 75
      unit: 'mL/kg/min',
      measured_at: FRESH_DATE,
      source: 'apple_health',
    },
    {
      metric_code: 'resting_hr',
      value_raw: 55, // Good: 50-59 → contribution 75
      unit: 'bpm',
      measured_at: FRESH_DATE,
      source: 'apple_health',
    },
  ],
  uploads: {
    apple_health: {
      status: 'completed',
      uploaded_at: FRESH_DATE,
      processed_at: FRESH_DATE,
    },
    photos: { count: 0 },
  },
  self_report: {
    age: 35,
    sex_at_birth: 'male',
  },
  loaded_at: NOW_ISO,
}

/**
 * Expected:
 * - Heart score: 75 (avg of vo2max 75 + resting_hr 75)
 * - Heart confidence: high (coverage 2/4=50%, freshness 100%)
 *   = round(100 * (0.7*0.5 + 0.3*1.0)) = round(100 * 0.65) = 65
 * - Other domains: null, confidence 0
 * - Prime score: 75 (only heart has score)
 */
export function testFixture2() {
  const scorecard = computePrimeScorecard(fixture2_heartOnlyFresh, NOW_ISO, SCORING_REVISION)
  
  const validation = validateScorecard(scorecard)
  console.log('Fixture 2 - Heart-only fresh:')
  console.log('  Valid:', validation.valid)
  console.log('  Prime score:', scorecard.prime_score)
  console.log('  Prime confidence:', scorecard.prime_confidence)
  console.log('  Heart score:', scorecard.domain_scores.heart)
  console.log('  Heart confidence:', scorecard.domain_confidence.heart)
  console.log('  Recovery score:', scorecard.domain_scores.recovery)
  
  // Assertions
  const pass = 
    validation.valid &&
    scorecard.domain_scores.heart === 75 &&
    scorecard.domain_confidence.heart === 65 &&
    scorecard.domain_scores.frame === null &&
    scorecard.domain_scores.metabolism === null &&
    scorecard.domain_scores.recovery === null &&
    scorecard.domain_scores.mind === null &&
    scorecard.prime_score === 75

  console.log('  PASS:', pass)
  return pass
}

// =============================================================================
// FIXTURE 3: Heart + Recovery with stale data (120 days old)
// =============================================================================

// Stale date (120 days old, beyond 90-day threshold)
const STALE_DATE = '2024-08-16T08:00:00.000Z'

export const fixture3_multiDomainStale: ScorecardInputs = {
  metrics: [
    {
      metric_code: 'vo2max',
      value_raw: 50, // Excellent: ≥50 → contribution 100
      unit: 'mL/kg/min',
      measured_at: STALE_DATE,
      source: 'apple_health',
    },
    {
      metric_code: 'resting_hr',
      value_raw: 48, // Excellent: <50 → contribution 100
      unit: 'bpm',
      measured_at: STALE_DATE,
      source: 'apple_health',
    },
    {
      metric_code: 'hrv',
      value_raw: 80, // Good: 70-99 → contribution 75
      unit: 'ms',
      measured_at: STALE_DATE,
      source: 'apple_health',
    },
    {
      metric_code: 'sleep',
      value_raw: 7.5, // Optimal: 7-9 → contribution 100
      unit: 'hr',
      measured_at: STALE_DATE,
      source: 'apple_health',
    },
  ],
  uploads: {
    apple_health: {
      status: 'completed',
      uploaded_at: STALE_DATE,
      processed_at: STALE_DATE,
    },
    photos: { count: 2, latest_uploaded_at: STALE_DATE },
  },
  self_report: {
    age: 40,
    sex_at_birth: 'female',
    height: 165,
    weight: 60,
    units: 'metric',
  },
  loaded_at: NOW_ISO,
}

/**
 * Expected:
 * - Heart score: 100 (avg of vo2max 100 + resting_hr 100)
 * - Heart confidence: low due to staleness
 *   coverage = 2/4 = 50%
 *   freshness = 0 (120 days > 90 days threshold)
 *   = round(100 * (0.7*0.5 + 0.3*0)) = round(100 * 0.35) = 35
 * - Recovery score: 88 (avg of hrv 75 + sleep 100)
 * - Recovery confidence: low
 *   coverage = 2/2 = 100%
 *   freshness = 0
 *   = round(100 * (0.7*1.0 + 0.3*0)) = round(100 * 0.70) = 70
 * - Prime score: avg of non-null = (100 + 88) / 2 = 94
 */
export function testFixture3() {
  const scorecard = computePrimeScorecard(fixture3_multiDomainStale, NOW_ISO, SCORING_REVISION)
  
  const validation = validateScorecard(scorecard)
  console.log('Fixture 3 - Multi-domain stale:')
  console.log('  Valid:', validation.valid)
  console.log('  Prime score:', scorecard.prime_score)
  console.log('  Prime confidence:', scorecard.prime_confidence)
  console.log('  Heart score:', scorecard.domain_scores.heart)
  console.log('  Heart confidence:', scorecard.domain_confidence.heart)
  console.log('  Recovery score:', scorecard.domain_scores.recovery)
  console.log('  Recovery confidence:', scorecard.domain_confidence.recovery)
  
  // Assertions (with some tolerance for rounding)
  const pass = 
    validation.valid &&
    scorecard.domain_scores.heart === 100 &&
    scorecard.domain_confidence.heart === 35 &&
    scorecard.domain_scores.recovery === 88 && // (75+100)/2 = 87.5 → 88
    scorecard.domain_confidence.recovery === 70 &&
    scorecard.prime_score === 94 // (100+88)/2 = 94

  console.log('  PASS:', pass)
  return pass
}

// =============================================================================
// RUN ALL FIXTURES
// =============================================================================

export function runAllFixtures(): boolean {
  console.log('\n========================================')
  console.log('Running Prime Scorecard Fixtures')
  console.log('========================================\n')

  const results = [
    testFixture1(),
    testFixture2(),
    testFixture3(),
  ]

  const allPassed = results.every(r => r)
  
  console.log('\n========================================')
  console.log(`Results: ${results.filter(r => r).length}/${results.length} passed`)
  console.log('========================================\n')

  return allPassed
}

// Export for use in scripts/tests
export { NOW_ISO, SCORING_REVISION }

