/**
 * Prime Scorecard Runtime Validation
 * 
 * Lightweight validation for PrimeScorecard objects.
 * Useful when receiving data from external sources (e.g., Railway worker).
 * 
 * This does NOT use Zod to avoid adding dependencies - manual checks only.
 */

import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS, EvidenceSource, ScorecardEvidence } from './types'

export type ValidationError = {
  path: string
  message: string
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
}

const VALID_SOURCES: EvidenceSource[] = ['apple_health', 'photo', 'self_report']

/**
 * Validates that a value is a valid ISO timestamp
 */
function isValidISOTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const date = new Date(value)
  return !isNaN(date.getTime()) && value.includes('T')
}

/**
 * Validates that a value is in range [min, max]
 */
function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Validates a single evidence item
 */
function validateEvidence(
  evidence: unknown, 
  index: number
): ValidationError[] {
  const errors: ValidationError[] = []
  const path = `evidence[${index}]`

  if (!evidence || typeof evidence !== 'object') {
    errors.push({ path, message: 'Evidence must be an object' })
    return errors
  }

  const e = evidence as Record<string, unknown>

  // domain
  if (!PRIME_DOMAINS.includes(e.domain as PrimeDomain)) {
    errors.push({ path: `${path}.domain`, message: `Invalid domain: ${e.domain}` })
  }

  // metric_code
  if (typeof e.metric_code !== 'string' || e.metric_code.length === 0) {
    errors.push({ path: `${path}.metric_code`, message: 'metric_code must be a non-empty string' })
  }

  // source
  if (!VALID_SOURCES.includes(e.source as EvidenceSource)) {
    errors.push({ path: `${path}.source`, message: `Invalid source: ${e.source}` })
  }

  // measured_at
  if (!isValidISOTimestamp(e.measured_at)) {
    errors.push({ path: `${path}.measured_at`, message: 'measured_at must be a valid ISO timestamp' })
  }

  // subscore (optional, but must be 0-100 if present)
  if (e.subscore !== undefined && e.subscore !== null) {
    if (typeof e.subscore !== 'number' || !isInRange(e.subscore, 0, 100)) {
      errors.push({ path: `${path}.subscore`, message: 'subscore must be a number between 0-100' })
    }
  }

  return errors
}

/**
 * Validates a PrimeScorecard object
 * 
 * @param data - The object to validate
 * @returns ValidationResult with valid flag and any errors
 */
export function validateScorecard(data: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ path: '', message: 'Scorecard must be an object' }] }
  }

  const sc = data as Record<string, unknown>

  // generated_at
  if (!isValidISOTimestamp(sc.generated_at)) {
    errors.push({ path: 'generated_at', message: 'generated_at must be a valid ISO timestamp' })
  }

  // prime_score (null or 0-100)
  if (sc.prime_score !== null) {
    if (typeof sc.prime_score !== 'number' || !isInRange(sc.prime_score, 0, 100)) {
      errors.push({ path: 'prime_score', message: 'prime_score must be null or a number between 0-100' })
    }
  }

  // domain_scores
  if (!sc.domain_scores || typeof sc.domain_scores !== 'object') {
    errors.push({ path: 'domain_scores', message: 'domain_scores must be an object' })
  } else {
    const ds = sc.domain_scores as Record<string, unknown>
    for (const domain of PRIME_DOMAINS) {
      const score = ds[domain]
      if (score !== null && score !== undefined) {
        if (typeof score !== 'number' || !isInRange(score, 0, 100)) {
          errors.push({ 
            path: `domain_scores.${domain}`, 
            message: `domain_scores.${domain} must be null or a number between 0-100` 
          })
        }
      }
    }
  }

  // prime_confidence (0-100)
  if (typeof sc.prime_confidence !== 'number' || !isInRange(sc.prime_confidence, 0, 100)) {
    errors.push({ path: 'prime_confidence', message: 'prime_confidence must be a number between 0-100' })
  }

  // domain_confidence
  if (!sc.domain_confidence || typeof sc.domain_confidence !== 'object') {
    errors.push({ path: 'domain_confidence', message: 'domain_confidence must be an object' })
  } else {
    const dc = sc.domain_confidence as Record<string, unknown>
    for (const domain of PRIME_DOMAINS) {
      const conf = dc[domain]
      if (typeof conf !== 'number' || !isInRange(conf, 0, 100)) {
        errors.push({ 
          path: `domain_confidence.${domain}`, 
          message: `domain_confidence.${domain} must be a number between 0-100` 
        })
      }
    }
  }

  // evidence (array)
  if (!Array.isArray(sc.evidence)) {
    errors.push({ path: 'evidence', message: 'evidence must be an array' })
  } else {
    for (let i = 0; i < sc.evidence.length; i++) {
      errors.push(...validateEvidence(sc.evidence[i], i))
    }
  }

  // how_calculated
  if (!sc.how_calculated || typeof sc.how_calculated !== 'object') {
    errors.push({ path: 'how_calculated', message: 'how_calculated must be an object' })
  } else {
    const hc = sc.how_calculated as Record<string, unknown>
    for (const domain of PRIME_DOMAINS) {
      if (!Array.isArray(hc[domain])) {
        errors.push({ 
          path: `how_calculated.${domain}`, 
          message: `how_calculated.${domain} must be an array of strings` 
        })
      }
    }
  }

  // scoring_revision
  if (typeof sc.scoring_revision !== 'string' || sc.scoring_revision.length === 0) {
    errors.push({ path: 'scoring_revision', message: 'scoring_revision must be a non-empty string' })
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Type guard that validates and narrows the type
 */
export function isValidScorecard(data: unknown): data is PrimeScorecard {
  return validateScorecard(data).valid
}

