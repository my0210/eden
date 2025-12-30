/**
 * Driver Scoring Methods
 * 
 * Implements the scoring methods defined in driver-registry.json:
 * - ladder: Map clinical categories to fixed bands
 * - proxy_map: Map discrete answers to score bands
 * - percentile: Map age/sex percentile to 0-100 (future)
 * - trend: Baseline-relative scoring (future)
 */

import {
  Observation,
  DriverConfig,
  ScoringConfig,
  LadderConfig,
  ProxyMapConfig,
  PercentileConfig,
} from './types'

/**
 * Score an observation using the ladder method
 * Evaluates value against bands in order
 */
function scoreLadder(
  value: number | string | boolean,
  config: LadderConfig
): { score: number; label?: string } {
  // Ladder method requires numeric values
  if (typeof value !== 'number') {
    return { score: config.default_score ?? 50 }
  }
  
  for (const band of config.bands) {
    const minOk = band.min === undefined || value >= band.min
    const maxOk = band.max === undefined || value < band.max
    
    if (minOk && maxOk) {
      return { score: band.score, label: band.label }
    }
  }
  
  return { score: config.default_score ?? 50 }
}

/**
 * Score an observation using the proxy_map method
 * Maps categorical values to scores
 */
function scoreProxyMap(
  value: number | string | boolean,
  config: ProxyMapConfig
): { score: number } {
  const stringValue = String(value)
  const score = config.mapping[stringValue]
  
  if (score !== undefined) {
    return { score }
  }
  
  return { score: config.default_score ?? 50 }
}

/**
 * Score an observation using the percentile method
 * Uses age/sex percentile tables (simplified for v1)
 */
function scorePercentile(
  value: number | string | boolean,
  config: PercentileConfig,
  userAge?: number,
  userSex?: string
): { score: number } {
  // Percentile method requires numeric values
  if (typeof value !== 'number') {
    return { score: 50 }
  }
  
  // For v1, use a simplified scoring based on population averages
  // TODO: Implement proper percentile lookup tables
  
  // This is a placeholder that maps the raw value directly to a score
  // In production, this would lookup age/sex-specific percentile tables
  const score = Math.max(0, Math.min(100, value))
  
  return { score }
}

/**
 * Score an observation using passthrough method
 * Used when the value is already a pre-computed 0-100 score
 */
function scorePassthrough(
  value: number | string | boolean,
  defaultScore: number = 50
): { score: number } {
  if (typeof value === 'number') {
    // Clamp to valid score range
    return { score: Math.max(0, Math.min(100, value)) }
  }
  return { score: defaultScore }
}

/**
 * Main scoring function
 * Dispatches to the appropriate method based on config
 */
export function scoreDriver(
  observation: Observation,
  driverConfig: DriverConfig,
  userContext?: { age?: number; sex?: string }
): { score: number; label?: string } {
  const { scoring } = driverConfig
  const { value } = observation
  
  switch (scoring.method) {
    case 'ladder':
      return scoreLadder(value, scoring as LadderConfig)
    
    case 'proxy_map':
      return scoreProxyMap(value, scoring as ProxyMapConfig)
    
    case 'percentile':
      return scorePercentile(
        value,
        scoring as PercentileConfig,
        userContext?.age,
        userContext?.sex
      )
    
    case 'passthrough':
      // Used for pre-computed scores (e.g., structural integrity)
      return scorePassthrough(value, (scoring as { default_score?: number }).default_score)
    
    case 'trend':
      // Trend scoring not implemented in v1
      // Fall back to default score
      return { score: 50 }
    
    default:
      console.warn(`Unknown scoring method: ${(scoring as ScoringConfig).method}`)
      return { score: 50 }
  }
}

/**
 * Get the label/category for a BP value
 * Used for derived atoms
 */
export function getBpCategory(
  systolic: number,
  diastolic?: number
): 'optimal' | 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis' | 'unknown' {
  // Use systolic as primary indicator
  if (systolic < 120) return 'optimal'
  if (systolic < 130) return 'normal'
  if (systolic < 140) return 'elevated'
  if (systolic < 160) return 'stage1'
  if (systolic < 180) return 'stage2'
  return 'crisis'
}

/**
 * Check if BP is in crisis range
 */
export function isBpCrisis(systolic: number, diastolic?: number): boolean {
  // Systolic >= 180 or diastolic >= 120 is hypertensive crisis
  return systolic >= 180 || (diastolic !== undefined && diastolic >= 120)
}

/**
 * Get RHR bucket from exact value
 */
export function getRhrBucket(bpm: number): string {
  if (bpm < 55) return '<55'
  if (bpm < 65) return '55-64'
  if (bpm < 75) return '65-74'
  if (bpm < 85) return '75-84'
  return '85+'
}

/**
 * Calculate waist-to-height ratio
 */
export function calculateWaistToHeight(waistCm: number, heightCm: number): number {
  if (heightCm <= 0) return 0
  return waistCm / heightCm
}

/**
 * Calculate BMI
 */
export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

/**
 * Derive metabolic risk category from diagnoses and family history
 */
export function deriveMetabolicRiskCategory(
  diagnoses: string[],
  familyHistory: string[]
): string {
  const hasDiabetes = diagnoses.includes('diabetes')
  const hasPrediabetes = diagnoses.includes('prediabetes')
  const hasConditions = diagnoses.filter(d => 
    !['none', 'unsure'].includes(d)
  ).length
  
  const hasFamilyHistory = familyHistory.filter(f => 
    !['none', 'unsure'].includes(f)
  ).length > 0
  
  if (hasDiabetes) return 'diabetes'
  if (hasConditions > 1) return 'multiple_conditions'
  if (hasConditions === 1) return 'one_condition'
  if (hasPrediabetes) return 'prediabetes'
  if (hasFamilyHistory) return 'family_history_only'
  return 'no_risk'
}

