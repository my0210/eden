/**
 * Canonical Metric Codes and Domain Expectations
 * 
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for expected metrics.
 * Do not define metric codes or expected metrics elsewhere.
 * 
 * Based on Eden Metrics v1 specification.
 */

import { PrimeDomain, EvidenceSource } from './types'

// =============================================================================
// METRIC CODES
// =============================================================================

/**
 * Canonical metric codes for the Prime Scorecard.
 * Each domain has a set of expected metrics.
 */
export type MetricCode =
  // Heart domain
  | 'vo2max'
  | 'blood_pressure'
  | 'resting_hr'
  | 'hr_recovery'
  // Frame domain
  | 'strength'
  | 'body_composition'
  | 'structural_integrity'
  | 'bone_density'
  // Metabolism domain
  | 'apob'
  | 'hba1c'
  | 'hs_crp'
  // Recovery domain
  | 'hrv'
  | 'sleep'
  // Mind domain
  | 'cognition'
  // Special: Photos as evidence (not a scorable metric)
  | 'photo_body'

/**
 * All metric codes as an array (for iteration)
 */
export const ALL_METRIC_CODES: readonly MetricCode[] = [
  'vo2max',
  'blood_pressure',
  'resting_hr',
  'hr_recovery',
  'strength',
  'body_composition',
  'structural_integrity',
  'bone_density',
  'apob',
  'hba1c',
  'hs_crp',
  'hrv',
  'sleep',
  'cognition',
  'photo_body',
] as const

// =============================================================================
// EXPECTED METRICS BY DOMAIN
// =============================================================================

/**
 * Expected metrics for each domain.
 * Used for confidence calculation (coverage = actual / expected).
 */
export const expectedMetricsByDomain: Record<PrimeDomain, MetricCode[]> = {
  heart: ['vo2max', 'blood_pressure', 'resting_hr', 'hr_recovery'],
  frame: ['strength', 'body_composition', 'structural_integrity', 'bone_density'],
  metabolism: ['apob', 'hba1c', 'hs_crp'],
  recovery: ['hrv', 'sleep'],
  mind: ['cognition'],
}

// =============================================================================
// METRIC DISPLAY INFO
// =============================================================================

/**
 * Display information for each metric.
 * Used by UI to show human-readable labels and units.
 */
export const metricDisplay: Record<MetricCode, {
  label: string
  unit?: string
  domain: PrimeDomain | null // null for non-domain metrics like photo_body
  description?: string
}> = {
  // Heart
  vo2max: {
    label: 'VO₂ Max',
    unit: 'mL/kg/min',
    domain: 'heart',
    description: 'Maximum oxygen uptake during exercise',
  },
  blood_pressure: {
    label: 'Blood Pressure',
    unit: 'mmHg',
    domain: 'heart',
    description: 'Systolic/diastolic blood pressure',
  },
  resting_hr: {
    label: 'Resting Heart Rate',
    unit: 'bpm',
    domain: 'heart',
    description: 'Heart rate at rest',
  },
  hr_recovery: {
    label: 'Heart Rate Recovery',
    unit: 'bpm',
    domain: 'heart',
    description: 'Heart rate drop after exercise',
  },

  // Frame
  strength: {
    label: 'Strength',
    domain: 'frame',
    description: 'Functional strength assessment',
  },
  body_composition: {
    label: 'Body Composition',
    unit: '%',
    domain: 'frame',
    description: 'Body fat percentage and lean mass',
  },
  structural_integrity: {
    label: 'Structural Integrity',
    domain: 'frame',
    description: 'Joint and mobility health',
  },
  bone_density: {
    label: 'Bone Density',
    domain: 'frame',
    description: 'Bone mineral density',
  },

  // Metabolism
  apob: {
    label: 'ApoB',
    unit: 'mg/dL',
    domain: 'metabolism',
    description: 'Apolipoprotein B (cardiovascular risk marker)',
  },
  hba1c: {
    label: 'HbA1c',
    unit: '%',
    domain: 'metabolism',
    description: 'Glycated hemoglobin (blood sugar average)',
  },
  hs_crp: {
    label: 'hs-CRP',
    unit: 'mg/L',
    domain: 'metabolism',
    description: 'High-sensitivity C-reactive protein (inflammation)',
  },

  // Recovery
  hrv: {
    label: 'Heart Rate Variability',
    unit: 'ms',
    domain: 'recovery',
    description: 'SDNN or RMSSD measurement',
  },
  sleep: {
    label: 'Sleep',
    unit: 'hours',
    domain: 'recovery',
    description: 'Sleep duration and quality',
  },

  // Mind
  cognition: {
    label: 'Cognition',
    domain: 'mind',
    description: 'Cognitive function assessment',
  },

  // Special (non-domain)
  photo_body: {
    label: 'Body Photo',
    domain: null, // Not a scorable metric, evidence only
    description: 'Progress photos for visual tracking',
  },
}

// =============================================================================
// METRIC SUPPORT STATUS
// =============================================================================

/**
 * Support status for each metric.
 * Tracks which sources can provide data and whether it's supported in v2.
 */
export const metricSupport: Record<MetricCode, {
  /** Which data sources can provide this metric */
  sources_supported: EvidenceSource[]
  /** Whether this metric is extractable in v2 */
  v2_supported: boolean
  /** Additional notes about support status */
  note?: string
}> = {
  // Heart - mostly supported via Apple Health
  vo2max: {
    sources_supported: ['apple_health'],
    v2_supported: true,
    note: 'Extracted from HKQuantityTypeIdentifierVO2Max',
  },
  blood_pressure: {
    sources_supported: ['apple_health', 'self_report'],
    v2_supported: true,
    note: 'Requires paired systolic/diastolic readings',
  },
  resting_hr: {
    sources_supported: ['apple_health'],
    v2_supported: true,
    note: 'Extracted from HKQuantityTypeIdentifierRestingHeartRate',
  },
  hr_recovery: {
    sources_supported: ['apple_health'],
    v2_supported: false,
    note: 'Requires workout end detection - future support',
  },

  // Frame - limited support in v2
  strength: {
    sources_supported: ['self_report'],
    v2_supported: false,
    note: 'Requires standardized assessment - future support',
  },
  body_composition: {
    sources_supported: ['apple_health', 'self_report'],
    v2_supported: true,
    note: 'Derived from weight and body fat percentage if available',
  },
  structural_integrity: {
    sources_supported: ['self_report'],
    v2_supported: false,
    note: 'Requires mobility assessment - future support',
  },
  bone_density: {
    sources_supported: ['self_report'],
    v2_supported: false,
    note: 'Requires DEXA scan data - future support',
  },

  // Metabolism - requires lab integration
  apob: {
    sources_supported: ['self_report'],
    v2_supported: false,
    note: 'Requires lab integration - future support',
  },
  hba1c: {
    sources_supported: ['self_report'],
    v2_supported: false,
    note: 'Requires lab integration - future support',
  },
  hs_crp: {
    sources_supported: ['self_report'],
    v2_supported: false,
    note: 'Requires lab integration - future support',
  },

  // Recovery - well supported
  hrv: {
    sources_supported: ['apple_health'],
    v2_supported: true,
    note: 'Extracted from HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  },
  sleep: {
    sources_supported: ['apple_health'],
    v2_supported: true,
    note: 'Extracted from HKCategoryTypeIdentifierSleepAnalysis',
  },

  // Mind - requires assessment
  cognition: {
    sources_supported: ['self_report'],
    v2_supported: false,
    note: 'Requires cognitive assessment integration - future support',
  },

  // Photo evidence
  photo_body: {
    sources_supported: ['photo'],
    v2_supported: true,
    note: 'Evidence only - no metric subscore in v2',
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all metrics supported in v2
 */
export function getV2SupportedMetrics(): MetricCode[] {
  return ALL_METRIC_CODES.filter(code => metricSupport[code].v2_supported)
}

/**
 * Get all metrics for a specific domain that are v2 supported
 */
export function getV2SupportedMetricsForDomain(domain: PrimeDomain): MetricCode[] {
  return expectedMetricsByDomain[domain].filter(code => metricSupport[code].v2_supported)
}

/**
 * Check if a metric code is valid
 */
export function isValidMetricCode(code: string): code is MetricCode {
  return ALL_METRIC_CODES.includes(code as MetricCode)
}

/**
 * Get the domain for a metric code
 */
export function getDomainForMetric(code: MetricCode): PrimeDomain | null {
  return metricDisplay[code].domain
}

// =============================================================================
// DOMAIN DISPLAY INFO
// =============================================================================

/**
 * Display information for each domain.
 * Used by UI for icons and labels.
 */
export const domainDisplay: Record<PrimeDomain, {
  label: string
  icon: string
  description: string
}> = {
  heart: {
    label: 'Heart',
    icon: '♥',
    description: 'Cardio & blood markers',
  },
  frame: {
    label: 'Frame',
    icon: '◼',
    description: 'Strength & body structure',
  },
  metabolism: {
    label: 'Metabolism',
    icon: '⚡',
    description: 'Energy & blood sugar',
  },
  recovery: {
    label: 'Recovery',
    icon: '☾',
    description: 'Sleep & HRV',
  },
  mind: {
    label: 'Mind',
    icon: '◉',
    description: 'Focus & cognition',
  },
}

