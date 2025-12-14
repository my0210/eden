/**
 * Apple Health Metric Mapping for Worker
 * 
 * Copied from lib/prime-scorecard/mapping.ts
 * This is the worker's local copy to avoid importing from the app.
 * 
 * IMPORTANT: Keep in sync with the app's mapping file.
 */

// Canonical metric codes (subset relevant for Apple Health)
export type MetricCode = 
  | 'vo2max'
  | 'resting_hr'
  | 'hrv'
  | 'sleep'
  | 'blood_pressure'
  | 'body_composition'

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
  metric_code: MetricCode
  hk_types: string[]
  unit: string
  aggregation: AggregationStrategy
  value_field: 'value'
  measured_at_field: 'endDate' | 'startDate'
  notes?: string
}

/**
 * Apple Health mappings for v2-supported metrics.
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
    unit: 'hr',
    aggregation: '7d_avg',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'Filter for asleep states, sum duration',
  },

  // Blood Pressure
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
    notes: 'Paired readings share the same endDate',
  },

  // Body Composition
  {
    metric_code: 'body_composition',
    hk_types: [
      'HKQuantityTypeIdentifierBodyMass',
      'HKQuantityTypeIdentifierBodyFatPercentage',
      'HKQuantityTypeIdentifierLeanBodyMass',
    ],
    unit: 'kg',
    aggregation: 'latest',
    value_field: 'value',
    measured_at_field: 'endDate',
    notes: 'Weight + body fat if available',
  },
]

/**
 * Build a lookup map from HK type identifier to mapping
 */
export function buildHkTypeToMappingLookup(): Map<string, AppleHealthRecordMapping> {
  const lookup = new Map<string, AppleHealthRecordMapping>()
  for (const mapping of appleHealthMappings) {
    for (const hkType of mapping.hk_types) {
      lookup.set(hkType, mapping)
    }
  }
  return lookup
}

/**
 * Get all HK type identifiers we care about
 */
export function getAllHkTypes(): Set<string> {
  const types = new Set<string>()
  for (const mapping of appleHealthMappings) {
    for (const hkType of mapping.hk_types) {
      types.add(hkType)
    }
  }
  return types
}

