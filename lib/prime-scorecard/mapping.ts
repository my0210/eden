/**
 * Metric Mapping Specification
 * 
 * Defines how canonical metric codes map to data sources.
 * This is the MAPPING SPEC, not implementation.
 * The Railway worker will consume this to parse Apple Health exports.
 * 
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for source identifiers.
 */

import { MetricCode } from './metrics'

// =============================================================================
// APPLE HEALTH MAPPING
// =============================================================================

/**
 * Aggregation strategy for Apple Health records
 */
export type AggregationStrategy = 
  | 'latest'       // Most recent single value
  | 'daily_avg'    // Average across most recent day with data
  | '7d_avg'       // Average over last 7 days
  | '30d_avg'      // Average over last 30 days

/**
 * Mapping specification for a single Apple Health metric
 */
export type AppleHealthRecordMapping = {
  /** Canonical metric code from metrics.ts */
  metric_code: MetricCode
  /** HealthKit type identifier(s) from export.xml */
  hk_types: string[]
  /** Expected unit in the export */
  unit: string
  /** How to aggregate multiple records */
  aggregation: AggregationStrategy
  /** XML attribute containing the value */
  value_field: 'value'
  /** XML attribute containing the timestamp */
  measured_at_field: 'endDate' | 'startDate'
  /** Additional notes for the parser */
  notes?: string
}

/**
 * Apple Health mappings for v2-supported metrics.
 * 
 * These use the actual HK type identifiers from export.xml.
 * The Railway worker will use this to parse the XML.
 */
export const appleHealthMappings: AppleHealthRecordMapping[] = [
  // VO2 Max
  {
    metric_code: 'vo2max',
    hk_types: ['HKQuantityTypeIdentifierVO2Max'],
    unit: 'mL/min·kg',
    aggregation: 'latest',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'Usually recorded by Apple Watch after outdoor walks/runs',
  },

  // Resting Heart Rate
  {
    metric_code: 'resting_hr',
    hk_types: ['HKQuantityTypeIdentifierRestingHeartRate'],
    unit: 'count/min',
    aggregation: '7d_avg',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'Daily resting HR from Apple Watch',
  },

  // HRV (SDNN)
  {
    metric_code: 'hrv',
    hk_types: ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN'],
    unit: 'ms',
    aggregation: '7d_avg',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'SDNN measurement, typically during sleep or rest',
  },

  // Sleep
  {
    metric_code: 'sleep',
    hk_types: ['HKCategoryTypeIdentifierSleepAnalysis'],
    unit: 'hr', // Converted from duration
    aggregation: '7d_avg',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'Filter for value="HKCategoryValueSleepAnalysisAsleepCore" or similar asleep states. Sum duration between startDate and endDate. Exclude "InBed" for actual sleep time.',
  },

  // Blood Pressure (Systolic)
  {
    metric_code: 'blood_pressure',
    hk_types: [
      'HKQuantityTypeIdentifierBloodPressureSystolic',
      'HKQuantityTypeIdentifierBloodPressureDiastolic',
    ],
    unit: 'mmHg',
    aggregation: 'latest',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'Paired readings share the same endDate. Store as "systolic/diastolic" string in value_raw.',
  },

  // Body Composition (Weight)
  {
    metric_code: 'body_composition',
    hk_types: [
      'HKQuantityTypeIdentifierBodyMass',
      'HKQuantityTypeIdentifierBodyFatPercentage',
      'HKQuantityTypeIdentifierLeanBodyMass',
    ],
    unit: 'kg', // Primary unit; body fat is %
    aggregation: 'latest',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'If only BodyMass available, store weight. If BodyFatPercentage also available, derive composition. Add note if incomplete.',
  },
]

/**
 * Get Apple Health mapping for a metric code
 */
export function getAppleHealthMapping(
  metricCode: MetricCode
): AppleHealthRecordMapping | undefined {
  return appleHealthMappings.find(m => m.metric_code === metricCode)
}

/**
 * Get all HK type identifiers we need to parse
 */
export function getAllAppleHealthTypes(): string[] {
  const types = new Set<string>()
  for (const mapping of appleHealthMappings) {
    for (const hkType of mapping.hk_types) {
      types.add(hkType)
    }
  }
  return Array.from(types)
}

// =============================================================================
// PHOTO EVIDENCE MAPPING
// =============================================================================

/**
 * Photo evidence specification.
 * Photos are stored as evidence but do NOT produce metric subscores in v2.
 */
export type PhotoEvidenceMapping = {
  /** Type of photo evidence */
  evidence_type: 'body_photo'
  /** Canonical metric code (for evidence association) */
  metric_code: 'photo_body'
  /** What we store from the photo */
  stored_fields: {
    /** Storage path in Supabase */
    storage_path: string
    /** When photo was uploaded */
    uploaded_at: string
    /** Optional user-provided date for the photo */
    photo_date?: string
    /** Which domains this photo relates to (for evidence) */
    related_domains: ('frame')[]
  }
  /** Notes about how photos are used */
  notes: string
}

/**
 * Photo evidence mapping for v2
 */
export const photoEvidenceMapping: PhotoEvidenceMapping = {
  evidence_type: 'body_photo',
  metric_code: 'photo_body',
  stored_fields: {
    storage_path: 'body-photos/{user_id}/{filename}',
    uploaded_at: 'ISO timestamp',
    photo_date: 'Optional user-specified date',
    related_domains: ['frame'],
  },
  notes: 'In v2, photos are evidence only. They appear in the evidence array but do not contribute to domain subscores. Future versions may extract body composition estimates from photos.',
}

// =============================================================================
// SELF-REPORT MAPPING (FUTURE)
// =============================================================================

/**
 * Self-report mapping placeholder.
 * To be defined when self-report UI is implemented.
 */
export type SelfReportMapping = {
  metric_code: MetricCode
  input_type: 'number' | 'range' | 'date' | 'text'
  validation?: {
    min?: number
    max?: number
    required?: boolean
  }
  prompt: string
}

// Self-report mappings will be added here when the UI is built
export const selfReportMappings: SelfReportMapping[] = [
  // Placeholder - to be implemented
]

