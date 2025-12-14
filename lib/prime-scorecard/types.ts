/**
 * Prime Scorecard Type Definitions
 * 
 * This file defines the stable contract for the Prime Scorecard.
 * All consumers (UI, coach, storage) should rely on these types.
 * 
 * IMPORTANT: Changes to these types should be backward-compatible
 * or accompanied by a migration strategy.
 */

/**
 * The five domains of the Prime Scorecard
 */
export type PrimeDomain = 'heart' | 'frame' | 'metabolism' | 'recovery' | 'mind'

/**
 * All valid Prime domains as an array (for iteration)
 */
export const PRIME_DOMAINS: readonly PrimeDomain[] = [
  'heart',
  'frame',
  'metabolism',
  'recovery',
  'mind',
] as const

/**
 * Sources of evidence for scoring
 */
export type EvidenceSource = 'apple_health' | 'photo' | 'self_report'

/**
 * A single piece of evidence used in scoring
 */
export type ScorecardEvidence = {
  /** Which domain this evidence contributes to */
  domain: PrimeDomain
  /** Canonical metric code (from metrics.ts) */
  metric_code: string
  /** Where this data came from */
  source: EvidenceSource
  /** When the underlying measurement was taken (ISO timestamp) */
  measured_at: string
  /** Raw value from the source (number or string for categorical) */
  value_raw?: number | string
  /** Unit of measurement */
  unit?: string
  /** Computed subscore for this evidence (0-100) */
  subscore?: number
  /** Optional note explaining special handling */
  note?: string
}

/**
 * The Prime Scorecard object shape
 * 
 * This is the contract that UI, coach, and storage rely on.
 * Scores can be null when insufficient evidence exists.
 */
export type PrimeScorecard = {
  /** When this scorecard was generated (ISO timestamp) */
  generated_at: string

  /** Overall Prime score (0-100), null if cannot be computed */
  prime_score: number | null

  /** Per-domain scores (0-100), null if domain has no evidence */
  domain_scores: Record<PrimeDomain, number | null>

  /** Overall confidence in the Prime score (0-100) */
  prime_confidence: number

  /** Per-domain confidence based on evidence coverage (0-100) */
  domain_confidence: Record<PrimeDomain, number>

  /** All evidence used to compute this scorecard */
  evidence: ScorecardEvidence[]

  /** Human-readable explanation of how each domain was calculated */
  how_calculated: Record<PrimeDomain, string[]>

  /**
   * Internal field for debugging and migration safety.
   * Use commit SHA or 'dev' for local development.
   * This is NOT user-facing.
   */
  scoring_revision: string
}

/**
 * Minimal scorecard for storage (without computed fields that can be re-derived)
 */
export type StoredScorecard = PrimeScorecard

