/**
 * Metric Contribution Mapping
 * 
 * Converts raw metric values into 0-100 contributions for scoring.
 * This is INTERNAL - raw values are shown in UI, not contributions.
 * 
 * The contribution represents how "good" a value is relative to health goals.
 * Higher contribution = better for health/longevity.
 */

import { MetricCode, metricSupport } from './metrics'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of contribution calculation
 */
export type ContributionResult = {
  /** 0-100 score representing health contribution */
  contribution: number
  /** Human-readable explanation of how the contribution was calculated */
  basis: string
}

// =============================================================================
// THRESHOLD CONFIGURATIONS
// =============================================================================

/**
 * VO2 Max thresholds (mL/kg/min)
 * Higher is better. Based on age-adjusted fitness percentiles.
 * 
 * Excellent (100): ≥50 (elite athlete level)
 * Good (75): 40-49
 * Average (50): 30-39
 * Below Average (25): 20-29
 * Poor (0): <20
 */
const VO2MAX_BANDS = {
  excellent: { min: 50, contribution: 100 },
  good: { min: 40, contribution: 75 },
  average: { min: 30, contribution: 50 },
  belowAverage: { min: 20, contribution: 25 },
  poor: { min: 0, contribution: 0 },
}

/**
 * Resting Heart Rate thresholds (bpm)
 * Lower is better (indicates good cardiovascular fitness).
 * 
 * Excellent (100): <50 bpm
 * Good (75): 50-59
 * Average (50): 60-69
 * Elevated (25): 70-79
 * High (0): ≥80
 */
const RESTING_HR_BANDS = {
  excellent: { max: 50, contribution: 100 },
  good: { max: 60, contribution: 75 },
  average: { max: 70, contribution: 50 },
  elevated: { max: 80, contribution: 25 },
  high: { max: Infinity, contribution: 0 },
}

/**
 * HRV (SDNN) thresholds (ms)
 * Higher is better (indicates good autonomic function).
 * 
 * Excellent (100): ≥100ms
 * Good (75): 70-99ms
 * Average (50): 40-69ms
 * Below Average (25): 20-39ms
 * Low (0): <20ms
 */
const HRV_BANDS = {
  excellent: { min: 100, contribution: 100 },
  good: { min: 70, contribution: 75 },
  average: { min: 40, contribution: 50 },
  belowAverage: { min: 20, contribution: 25 },
  low: { min: 0, contribution: 0 },
}

/**
 * Sleep duration thresholds (hours)
 * 7-9 hours is optimal. Both too little and too much are suboptimal.
 * 
 * Optimal (100): 7-9 hours
 * Good (75): 6-7 or 9-10 hours
 * Suboptimal (50): 5-6 or 10-11 hours
 * Poor (25): 4-5 or 11-12 hours
 * Very Poor (0): <4 or >12 hours
 */
const SLEEP_BANDS = {
  optimal: { min: 7, max: 9, contribution: 100 },
  good_low: { min: 6, max: 7, contribution: 75 },
  good_high: { min: 9, max: 10, contribution: 75 },
  suboptimal_low: { min: 5, max: 6, contribution: 50 },
  suboptimal_high: { min: 10, max: 11, contribution: 50 },
  poor_low: { min: 4, max: 5, contribution: 25 },
  poor_high: { min: 11, max: 12, contribution: 25 },
  // Outside these ranges = 0
}

/**
 * Blood Pressure thresholds (systolic/diastolic mmHg)
 * Lower is generally better (within healthy range).
 * 
 * Optimal (100): <120/80
 * Normal (75): 120-129/<80
 * Elevated (50): 130-139/80-89
 * High Stage 1 (25): 140-159/90-99
 * High Stage 2 (0): ≥160/100
 */
const BP_BANDS = {
  optimal: { systolic_max: 120, diastolic_max: 80, contribution: 100 },
  normal: { systolic_max: 130, diastolic_max: 80, contribution: 75 },
  elevated: { systolic_max: 140, diastolic_max: 90, contribution: 50 },
  high1: { systolic_max: 160, diastolic_max: 100, contribution: 25 },
  high2: { systolic_max: Infinity, diastolic_max: Infinity, contribution: 0 },
}

/**
 * Body Fat Percentage thresholds (varies by sex)
 * Optimal ranges differ for males and females.
 * 
 * Male:
 *   Athletic (100): 6-13%
 *   Fit (75): 14-17%
 *   Average (50): 18-24%
 *   Above Average (25): 25-30%
 *   Obese (0): >30%
 * 
 * Female:
 *   Athletic (100): 14-20%
 *   Fit (75): 21-24%
 *   Average (50): 25-31%
 *   Above Average (25): 32-38%
 *   Obese (0): >38%
 */
const BODY_FAT_BANDS = {
  male: {
    athletic: { min: 6, max: 13, contribution: 100 },
    fit: { min: 14, max: 17, contribution: 75 },
    average: { min: 18, max: 24, contribution: 50 },
    aboveAverage: { min: 25, max: 30, contribution: 25 },
    obese: { min: 31, max: Infinity, contribution: 0 },
  },
  female: {
    athletic: { min: 14, max: 20, contribution: 100 },
    fit: { min: 21, max: 24, contribution: 75 },
    average: { min: 25, max: 31, contribution: 50 },
    aboveAverage: { min: 32, max: 38, contribution: 25 },
    obese: { min: 39, max: Infinity, contribution: 0 },
  },
}

// =============================================================================
// CONTRIBUTION FUNCTIONS
// =============================================================================

/**
 * Convert a metric value to a 0-100 contribution score.
 * 
 * @param metric_code - Canonical metric code from metrics.ts
 * @param value_raw - Raw value from the metric
 * @param unit - Optional unit (used for validation)
 * @param sex - Optional sex for body composition (defaults to unisex average)
 * @returns ContributionResult or null if metric cannot be scored
 */
export function toContribution(
  metric_code: string,
  value_raw: number | string | boolean,
  unit?: string,
  sex?: 'male' | 'female'
): ContributionResult | null {
  // Check if metric is v2 supported
  const support = metricSupport[metric_code as MetricCode]
  if (!support?.v2_supported) {
    return null
  }

  // Parse value to number if needed
  const numValue = typeof value_raw === 'number' ? value_raw : parseFloat(String(value_raw))
  if (isNaN(numValue)) {
    return null
  }

  switch (metric_code) {
    case 'vo2max':
      return computeVO2MaxContribution(numValue)
    
    case 'resting_hr':
      return computeRestingHRContribution(numValue)
    
    case 'hrv':
      return computeHRVContribution(numValue)
    
    case 'sleep':
      return computeSleepContribution(numValue)
    
    case 'blood_pressure':
      return computeBloodPressureContribution(value_raw)
    
    case 'body_composition':
      return computeBodyCompositionContribution(numValue, sex)
    
    default:
      return null
  }
}

function computeVO2MaxContribution(value: number): ContributionResult {
  let contribution: number
  let band: string

  if (value >= VO2MAX_BANDS.excellent.min) {
    contribution = 100
    band = 'Excellent (≥50)'
  } else if (value >= VO2MAX_BANDS.good.min) {
    contribution = 75
    band = 'Good (40-49)'
  } else if (value >= VO2MAX_BANDS.average.min) {
    contribution = 50
    band = 'Average (30-39)'
  } else if (value >= VO2MAX_BANDS.belowAverage.min) {
    contribution = 25
    band = 'Below Average (20-29)'
  } else {
    contribution = 0
    band = 'Poor (<20)'
  }

  return {
    contribution: clamp(contribution, 0, 100),
    basis: `VO2 Max ${value.toFixed(1)} mL/kg/min → ${band}`,
  }
}

function computeRestingHRContribution(value: number): ContributionResult {
  let contribution: number
  let band: string

  if (value < RESTING_HR_BANDS.excellent.max) {
    contribution = 100
    band = 'Excellent (<50)'
  } else if (value < RESTING_HR_BANDS.good.max) {
    contribution = 75
    band = 'Good (50-59)'
  } else if (value < RESTING_HR_BANDS.average.max) {
    contribution = 50
    band = 'Average (60-69)'
  } else if (value < RESTING_HR_BANDS.elevated.max) {
    contribution = 25
    band = 'Elevated (70-79)'
  } else {
    contribution = 0
    band = 'High (≥80)'
  }

  return {
    contribution: clamp(contribution, 0, 100),
    basis: `Resting HR ${Math.round(value)} bpm → ${band}`,
  }
}

function computeHRVContribution(value: number): ContributionResult {
  let contribution: number
  let band: string

  if (value >= HRV_BANDS.excellent.min) {
    contribution = 100
    band = 'Excellent (≥100)'
  } else if (value >= HRV_BANDS.good.min) {
    contribution = 75
    band = 'Good (70-99)'
  } else if (value >= HRV_BANDS.average.min) {
    contribution = 50
    band = 'Average (40-69)'
  } else if (value >= HRV_BANDS.belowAverage.min) {
    contribution = 25
    band = 'Below Average (20-39)'
  } else {
    contribution = 0
    band = 'Low (<20)'
  }

  return {
    contribution: clamp(contribution, 0, 100),
    basis: `HRV ${Math.round(value)} ms → ${band}`,
  }
}

function computeSleepContribution(value: number): ContributionResult {
  let contribution: number
  let band: string

  // Sleep is optimal in the middle range
  if (value >= 7 && value <= 9) {
    contribution = 100
    band = 'Optimal (7-9h)'
  } else if ((value >= 6 && value < 7) || (value > 9 && value <= 10)) {
    contribution = 75
    band = value < 7 ? 'Slightly low (6-7h)' : 'Slightly high (9-10h)'
  } else if ((value >= 5 && value < 6) || (value > 10 && value <= 11)) {
    contribution = 50
    band = value < 6 ? 'Low (5-6h)' : 'High (10-11h)'
  } else if ((value >= 4 && value < 5) || (value > 11 && value <= 12)) {
    contribution = 25
    band = value < 5 ? 'Very low (4-5h)' : 'Very high (11-12h)'
  } else {
    contribution = 0
    band = value < 4 ? 'Severely low (<4h)' : 'Severely high (>12h)'
  }

  return {
    contribution: clamp(contribution, 0, 100),
    basis: `Sleep ${value.toFixed(1)} hours → ${band}`,
  }
}

function computeBloodPressureContribution(value: number | string | boolean): ContributionResult | null {
  // Blood pressure may be stored as "systolic/diastolic" string or just systolic number
  // Boolean values are not valid for BP
  if (typeof value === 'boolean') {
    return null
  }
  
  let systolic: number
  let diastolic: number | null = null

  if (typeof value === 'string' && value.includes('/')) {
    const parts = value.split('/')
    systolic = parseFloat(parts[0])
    diastolic = parseFloat(parts[1])
    if (isNaN(systolic) || isNaN(diastolic)) {
      return null
    }
  } else {
    // Only systolic available - cannot compute accurate BP score
    return null
  }

  let contribution: number
  let band: string

  // Use the worse of systolic/diastolic for the band
  if (systolic < BP_BANDS.optimal.systolic_max && diastolic < BP_BANDS.optimal.diastolic_max) {
    contribution = 100
    band = 'Optimal (<120/80)'
  } else if (systolic < BP_BANDS.normal.systolic_max && diastolic < BP_BANDS.normal.diastolic_max) {
    contribution = 75
    band = 'Normal (120-129/<80)'
  } else if (systolic < BP_BANDS.elevated.systolic_max && diastolic < BP_BANDS.elevated.diastolic_max) {
    contribution = 50
    band = 'Elevated (130-139/80-89)'
  } else if (systolic < BP_BANDS.high1.systolic_max && diastolic < BP_BANDS.high1.diastolic_max) {
    contribution = 25
    band = 'High Stage 1 (140-159/90-99)'
  } else {
    contribution = 0
    band = 'High Stage 2 (≥160/100)'
  }

  return {
    contribution: clamp(contribution, 0, 100),
    basis: `BP ${Math.round(systolic)}/${Math.round(diastolic)} mmHg → ${band}`,
  }
}

function computeBodyCompositionContribution(
  bodyFatPercent: number,
  sex?: 'male' | 'female'
): ContributionResult | null {
  // If body fat is 0 or unrealistic, likely just weight without body fat
  if (bodyFatPercent <= 0 || bodyFatPercent > 60) {
    return null
  }

  // Use sex-specific bands, default to average of male/female if not specified
  const bands = sex === 'female' ? BODY_FAT_BANDS.female : BODY_FAT_BANDS.male
  const sexLabel = sex || 'unisex'

  let contribution: number
  let band: string

  if (bodyFatPercent <= bands.athletic.max) {
    contribution = 100
    band = 'Athletic'
  } else if (bodyFatPercent <= bands.fit.max) {
    contribution = 75
    band = 'Fit'
  } else if (bodyFatPercent <= bands.average.max) {
    contribution = 50
    band = 'Average'
  } else if (bodyFatPercent <= bands.aboveAverage.max) {
    contribution = 25
    band = 'Above Average'
  } else {
    contribution = 0
    band = 'Obese'
  }

  return {
    contribution: clamp(contribution, 0, 100),
    basis: `Body fat ${bodyFatPercent.toFixed(1)}% (${sexLabel}) → ${band}`,
  }
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Check if a metric code is scorable (has contribution logic)
 */
export function isScorableMetric(metric_code: string): boolean {
  const scorable = ['vo2max', 'resting_hr', 'hrv', 'sleep', 'blood_pressure', 'body_composition']
  return scorable.includes(metric_code)
}

