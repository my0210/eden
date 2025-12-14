/**
 * Prime Scorecard Contract Helpers
 * 
 * Utility functions for creating and working with PrimeScorecard objects.
 * NO scoring logic belongs here - this is just contract helpers.
 */

import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS } from './types'

/**
 * Creates an empty scorecard with null scores and empty evidence.
 * Use this as the starting point before computing scores.
 * 
 * @param generated_at - ISO timestamp when scorecard is generated
 * @param scoring_revision - Version identifier for debugging (commit SHA or 'dev')
 */
export function emptyScorecard(
  generated_at: string = new Date().toISOString(),
  scoring_revision: string = 'dev'
): PrimeScorecard {
  // Initialize domain scores as null (no evidence yet)
  const domain_scores: Record<PrimeDomain, number | null> = {
    heart: null,
    frame: null,
    metabolism: null,
    recovery: null,
    mind: null,
  }

  // Initialize domain confidence as 0 (no evidence)
  const domain_confidence: Record<PrimeDomain, number> = {
    heart: 0,
    frame: 0,
    metabolism: 0,
    recovery: 0,
    mind: 0,
  }

  // Initialize empty how_calculated
  const how_calculated: Record<PrimeDomain, string[]> = {
    heart: [],
    frame: [],
    metabolism: [],
    recovery: [],
    mind: [],
  }

  return {
    generated_at,
    prime_score: null,
    domain_scores,
    prime_confidence: 0,
    domain_confidence,
    evidence: [],
    how_calculated,
    scoring_revision,
  }
}

/**
 * Checks if a scorecard has any computed scores
 */
export function hasAnyScores(scorecard: PrimeScorecard): boolean {
  return scorecard.prime_score !== null || 
    PRIME_DOMAINS.some(d => scorecard.domain_scores[d] !== null)
}

/**
 * Checks if a scorecard has evidence for a specific domain
 */
export function hasEvidenceForDomain(
  scorecard: PrimeScorecard, 
  domain: PrimeDomain
): boolean {
  return scorecard.evidence.some(e => e.domain === domain)
}

/**
 * Gets all domains that have at least some evidence
 */
export function getDomainsWithEvidence(scorecard: PrimeScorecard): PrimeDomain[] {
  const domains = new Set<PrimeDomain>()
  for (const e of scorecard.evidence) {
    domains.add(e.domain)
  }
  return Array.from(domains)
}

/**
 * Counts evidence items per domain
 */
export function countEvidenceByDomain(
  scorecard: PrimeScorecard
): Record<PrimeDomain, number> {
  const counts: Record<PrimeDomain, number> = {
    heart: 0,
    frame: 0,
    metabolism: 0,
    recovery: 0,
    mind: 0,
  }
  
  for (const e of scorecard.evidence) {
    counts[e.domain]++
  }
  
  return counts
}

