/**
 * Scoring Engine Types
 * 
 * These types define the core abstractions for the config-driven scoring engine.
 * The engine is deterministic and produces 5 domain scores + Prime Score.
 */

import { PrimeDomain } from '../types'

// ============================================================================
// Source Types (Priority Order: lab > test > device > measured_self_report > self_report_proxy > prior)
// ============================================================================

/**
 * Source types in priority order (highest to lowest)
 * - lab: Lab results (HbA1c, ApoB, etc.)
 * - test: Objective test (PVT-lite when implemented)
 * - device: Apple Health, wearables
 * - measured_self_report: User-entered with numeric value + date (BP, RHR)
 * - image_estimate: AI analysis of body photos (body fat, midsection adiposity)
 * - self_report_proxy: Quick check answers (cardio self-rating, pushup bucket)
 * - prior: Population prior when nothing else available
 */
export type SourceType = 
  | 'lab'
  | 'test'
  | 'device'
  | 'measured_self_report'
  | 'image_estimate'
  | 'self_report_proxy'
  | 'prior'

/**
 * Default source priority order (used when driver config doesn't specify)
 */
export const DEFAULT_SOURCE_PRIORITY: SourceType[] = [
  'lab',
  'test',
  'device',
  'measured_self_report',
  'image_estimate',
  'self_report_proxy',
  'prior',
]

/**
 * Quality multipliers for confidence calculation
 * lab=1.0, test=0.9, device=0.8, measured_self_report=0.7, image_estimate=0.55, proxy=0.4, prior=0.2
 */
export const SOURCE_QUALITY_MULTIPLIERS: Record<SourceType, number> = {
  lab: 1.0,
  test: 0.9,
  device: 0.8,
  measured_self_report: 0.7,
  image_estimate: 0.55,
  self_report_proxy: 0.4,
  prior: 0.2,
}

// ============================================================================
// Observation Types
// ============================================================================

/**
 * A single evidence record for a driver
 */
export interface Observation {
  /** The driver this observation is for */
  driver_key: string
  /** The value (numeric, categorical, or boolean) */
  value: number | string | boolean
  /** Unit of measurement (optional for categorical values) */
  unit?: string
  /** When the measurement was taken (ISO timestamp) */
  measured_at: string
  /** Source type (determines priority) */
  source_type: SourceType
  /** Optional metadata about the observation */
  metadata?: {
    device_name?: string
    entry_method?: string
    source_batch_id?: string // e.g., apple_health_imports.id
    [key: string]: unknown
  }
}

/**
 * Resolved observation with computed score
 */
export interface ResolvedObservation extends Observation {
  /** Computed driver score (0-100) */
  driver_score: number
  /** If true, this observation conflicts with a higher-priority source */
  conflict_flag?: boolean
  /** Freshness score (0-1) based on age and half-life */
  freshness_score: number
}

// ============================================================================
// Driver Configuration Types
// ============================================================================

/**
 * Scoring method determines how raw values are converted to 0-100 scores
 * - ladder: Map clinical categories to fixed bands (BP, HbA1c, ApoB)
 * - percentile: Map age/sex percentile to 0-100 (VO2max when available)
 * - proxy_map: Map discrete answers to score bands (pushup bucket, focus stability)
 * - trend: Baseline-relative for time series (future, not v1)
 */
export type ScoringMethod = 'ladder' | 'percentile' | 'proxy_map' | 'trend'

/**
 * Ladder scoring configuration
 * Maps value ranges to scores
 */
export interface LadderConfig {
  method: 'ladder'
  /** Array of [min, max, score] tuples, evaluated in order */
  bands: Array<{
    min?: number
    max?: number
    score: number
    label?: string
  }>
  /** Default score if value doesn't match any band */
  default_score?: number
}

/**
 * Proxy map scoring configuration
 * Maps categorical values to scores
 */
export interface ProxyMapConfig {
  method: 'proxy_map'
  /** Map of categorical value to score */
  mapping: Record<string, number>
  /** Default score if value not in mapping */
  default_score?: number
}

/**
 * Percentile scoring configuration
 * Uses age/sex percentile tables
 */
export interface PercentileConfig {
  method: 'percentile'
  /** Reference data key for percentile lookup */
  percentile_table: string
  /** Whether lower is better (e.g., RHR) */
  lower_is_better?: boolean
  /** Default score if lookup fails */
  default_score?: number
}

/**
 * Trend scoring configuration (future)
 */
export interface TrendConfig {
  method: 'trend'
  baseline_days: number
  improvement_target_percent: number
}

export type ScoringConfig = LadderConfig | ProxyMapConfig | PercentileConfig | TrendConfig

/**
 * Domain contribution - how a driver contributes to a specific domain
 */
export interface DomainContribution {
  domain: PrimeDomain
  /** Weight within this domain (0-1) */
  weight: number
  /** Max weight share after reallocation for this domain */
  dominance_cap: number
}

/**
 * Configuration for a single driver (metric)
 * 
 * A driver can contribute to multiple domains via domain_contributions.
 * For single-domain drivers, use the simpler domain/weight/dominance_cap fields.
 */
export interface DriverConfig {
  /** Unique key for this driver (e.g., 'bp', 'vo2max', 'rhr') */
  driver_key: string
  /** Display name for UI */
  display_name: string
  /** Scoring configuration */
  scoring: ScoringConfig
  /** Source priority override (uses DEFAULT_SOURCE_PRIORITY if not specified) */
  source_priority?: SourceType[]
  /** Half-life in days for freshness decay */
  freshness_half_life_days: number
  /** Minimum days of baseline data for stability (0 = no requirement) */
  stability_requirement?: number
  /** UI text for "what's missing" when driver has no observation */
  missing_copy: string
  /** Map of source_type to UI chip label (only needs entries for sources used by this driver) */
  evidence_label_map?: Partial<Record<SourceType, string>>
  
  // --- Domain contribution (use ONE of the following approaches) ---
  
  /** For multi-domain drivers: array of domain contributions */
  domain_contributions?: DomainContribution[]
  
  /** For single-domain drivers: the domain (backwards compatible) */
  domain?: PrimeDomain
  /** For single-domain drivers: weight within domain */
  weight?: number
  /** For single-domain drivers: max weight share after reallocation */
  dominance_cap?: number
}

/**
 * Get all domain contributions for a driver (normalizes single vs multi-domain)
 */
export function getDriverDomainContributions(config: DriverConfig): DomainContribution[] {
  // Multi-domain: use domain_contributions array
  if (config.domain_contributions && config.domain_contributions.length > 0) {
    return config.domain_contributions
  }
  
  // Single-domain: convert to contribution array
  if (config.domain && config.weight !== undefined && config.dominance_cap !== undefined) {
    return [{
      domain: config.domain,
      weight: config.weight,
      dominance_cap: config.dominance_cap,
    }]
  }
  
  // No valid domain configuration
  console.warn(`Driver ${config.driver_key} has no valid domain configuration`)
  return []
}

/**
 * The complete driver registry loaded from config
 */
export interface DriverRegistry {
  /** Version for migration safety */
  version: number
  /** All driver configurations indexed by driver_key */
  drivers: Record<string, DriverConfig>
  /** Domain weight for Prime Score calculation (defaults to 0.2 each) */
  domain_weights?: Record<PrimeDomain, number>
}

// ============================================================================
// Scoring Result Types
// ============================================================================

/**
 * Result of scoring a single driver
 */
export interface DriverScoringResult {
  driver_key: string
  driver_score: number
  source_type: SourceType
  measured_at: string
  value: number | string | boolean
  unit?: string
  conflict_flag?: boolean
  freshness_score: number
}

/**
 * Evidence summary for a domain (for UI)
 */
export interface DomainEvidenceSummary {
  /** Drivers that have observations */
  drivers_used: Array<{
    driver_key: string
    display_name: string
    source_type: SourceType
    measured_at: string
    has_value: boolean
  }>
  /** Drivers missing from registry */
  missing_drivers: Array<{
    driver_key: string
    display_name: string
    missing_copy: string
  }>
  /** Single CTA for improving accuracy */
  fastest_upgrade_action: string | null
}

/**
 * Derived atoms for coach context
 */
export interface DomainDerivedAtoms {
  // Heart
  bp_category?: 'optimal' | 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis' | 'unknown'
  bp_crisis_flag?: boolean
  cardio_self_rating_bucket?: string
  rhr_bucket?: string
  heart_missing_top_action?: string
  
  // Frame
  waist_to_height?: number
  strength_bucket?: string
  limitation_flag?: boolean
  
  // Metabolism
  labs_present?: boolean
  met_risk_flags?: string[]
  managed_with_meds?: boolean
  
  // Recovery
  sleep_bucket?: string
  regularity_flag?: boolean
  insomnia_bucket?: string
  
  // Mind
  mind_test_present?: boolean
  focus_bucket?: string
  fog_bucket?: string
  
  [key: string]: unknown
}

/**
 * Risk flags extracted from observations
 */
export interface RiskFlags {
  bp_crisis_flag?: boolean
  severe_pain_flag?: boolean
  diabetes_flag?: boolean
  [key: string]: boolean | undefined
}

/**
 * Result for a single domain
 */
export interface DomainScoringResult {
  /** Domain identifier */
  domain: PrimeDomain
  /** Domain score (0-100) - always present */
  domain_score: number
  /** Domain confidence (0-100) */
  domain_confidence: number
  /** Confidence label for UI */
  confidence_label: 'Low' | 'Medium' | 'High'
  /** Confidence copy for UI */
  confidence_copy: string
  /** Evidence summary for UI */
  evidence_summary: DomainEvidenceSummary
  /** Risk flags (e.g., bp_crisis_flag) */
  risk_flags: RiskFlags
  /** Derived atoms for coach context */
  derived_atoms: DomainDerivedAtoms
  /** Individual driver scoring results */
  driver_results: DriverScoringResult[]
  /** Whether using prior (no real observations) */
  using_prior: boolean
}

/**
 * Complete scorecard result from scoring engine
 */
export interface ScorecardResult {
  /** When this scorecard was generated (ISO timestamp) */
  generated_at: string
  /** Overall Prime score (0-100) - always present */
  prime_score: number
  /** Prime confidence (0-100) */
  prime_confidence: number
  /** Per-domain results */
  domain_results: Record<PrimeDomain, DomainScoringResult>
  /** How calculated data for progressive disclosure */
  how_calculated: Record<PrimeDomain, string[]>
  /** Scoring engine version for debugging */
  scoring_revision: string
}

// ============================================================================
// Confidence Label Constants
// ============================================================================

/**
 * Confidence thresholds for labels
 */
export const CONFIDENCE_THRESHOLDS = {
  LOW: 40,
  HIGH: 70,
} as const

/**
 * Confidence label copy
 */
export const CONFIDENCE_COPY: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'Estimated from quick checks.',
  Medium: 'Based on measurements you provided (and quick checks).',
  High: 'Based on device, lab, or test data.',
}

/**
 * Get confidence label from numeric value
 */
export function getConfidenceLabel(confidence: number): 'Low' | 'Medium' | 'High' {
  if (confidence < CONFIDENCE_THRESHOLDS.LOW) return 'Low'
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'High'
  return 'Medium'
}

/**
 * Hard confidence caps for specific domains
 */
export const DOMAIN_CONFIDENCE_CAPS: Partial<Record<PrimeDomain, { cap: number; condition: string }>> = {
  metabolism: { cap: 40, condition: 'no_biomarker_values' },
  mind: { cap: 35, condition: 'no_focus_test' },
}

// ============================================================================
// Default Domain Weights
// ============================================================================

/**
 * Default weights for Prime Score calculation (equal weighting)
 */
export const DEFAULT_DOMAIN_WEIGHTS: Record<PrimeDomain, number> = {
  heart: 0.2,
  frame: 0.2,
  metabolism: 0.2,
  recovery: 0.2,
  mind: 0.2,
}

