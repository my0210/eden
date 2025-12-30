/**
 * Domain Confidence Calculation
 * 
 * Computes confidence scores based on:
 * - Coverage: Weighted fraction of drivers present
 * - Quality: Source quality multipliers
 * - Freshness: Age-based decay using half-life
 * - Stability: Time-series baseline (simplified for v1)
 * - Multi-domain drivers (one driver can contribute to multiple domains)
 */

import { PrimeDomain } from '../types'
import {
  DriverConfig,
  DriverScoringResult,
  SOURCE_QUALITY_MULTIPLIERS,
  DOMAIN_CONFIDENCE_CAPS,
  CONFIDENCE_THRESHOLDS,
  CONFIDENCE_COPY,
  getConfidenceLabel,
  getDriverDomainContributions,
  DomainContribution,
} from './types'

/**
 * Check if a driver contributes to a domain
 */
function driverContributesToDomain(config: DriverConfig, domain: PrimeDomain): boolean {
  const contributions = getDriverDomainContributions(config)
  return contributions.some(c => c.domain === domain)
}

/**
 * Get the contribution config for a driver in a domain
 */
function getDomainContribution(config: DriverConfig, domain: PrimeDomain): DomainContribution | null {
  const contributions = getDriverDomainContributions(config)
  return contributions.find(c => c.domain === domain) || null
}

/**
 * Confidence formula weights
 * Confidence = 100 * (0.35*Coverage + 0.25*Quality + 0.25*Freshness + 0.15*Stability)
 */
const CONFIDENCE_WEIGHTS = {
  coverage: 0.35,
  quality: 0.25,
  freshness: 0.25,
  stability: 0.15,
}

/**
 * Calculate coverage component
 * Coverage = sum(w_i for drivers present) using domain-specific weights
 */
function calculateCoverage(
  domain: PrimeDomain,
  presentDriverKeys: Set<string>,
  allDriverConfigs: DriverConfig[]
): number {
  // Filter to drivers that contribute to this domain
  const domainConfigs = allDriverConfigs.filter(c => driverContributesToDomain(c, domain))
  
  let coveredWeight = 0
  for (const config of domainConfigs) {
    if (presentDriverKeys.has(config.driver_key)) {
      const contribution = getDomainContribution(config, domain)
      if (contribution) {
        coveredWeight += contribution.weight
      }
    }
  }
  
  return coveredWeight // Already 0-1 since domain weights sum to 1
}

/**
 * Calculate quality component
 * Quality = weighted mean of source quality multipliers for drivers present
 */
function calculateQuality(
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>
): number {
  if (driverResults.length === 0) {
    return 0
  }
  
  let weightedQualitySum = 0
  let totalWeight = 0
  
  for (const result of driverResults) {
    const config = driverConfigs.get(result.driver_key)
    if (!config) continue
    
    const qualityMultiplier = SOURCE_QUALITY_MULTIPLIERS[result.source_type] ?? 0.2
    weightedQualitySum += config.weight * qualityMultiplier
    totalWeight += config.weight
  }
  
  if (totalWeight === 0) {
    return 0
  }
  
  return weightedQualitySum / totalWeight
}

/**
 * Calculate freshness component
 * Freshness = weighted mean of freshness scores for drivers present
 */
function calculateFreshness(
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>
): number {
  if (driverResults.length === 0) {
    return 0
  }
  
  let weightedFreshnessSum = 0
  let totalWeight = 0
  
  for (const result of driverResults) {
    const config = driverConfigs.get(result.driver_key)
    if (!config) continue
    
    weightedFreshnessSum += config.weight * result.freshness_score
    totalWeight += config.weight
  }
  
  if (totalWeight === 0) {
    return 0
  }
  
  return weightedFreshnessSum / totalWeight
}

/**
 * Calculate stability component
 * For v1, stability is 0 unless driver has time-series baseline
 * (simplified - always 0 for onboarding)
 */
function calculateStability(
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>
): number {
  // v1 simplification: stability is 0 for all onboarding data
  // In future, this would check if drivers have time-series baselines
  // meeting their stability_requirement from config
  return 0
}

/**
 * Check if domain has biomarker values (for Metabolism cap)
 */
function hasBiomarkerValues(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[]
): boolean {
  if (domain !== 'metabolism') return true
  
  const labDrivers = ['hba1c', 'apob', 'hscrp']
  return driverResults.some(r => 
    labDrivers.includes(r.driver_key) && r.source_type === 'lab'
  )
}

/**
 * Check if domain has focus test (for Mind cap)
 */
function hasFocusTest(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[]
): boolean {
  if (domain !== 'mind') return true
  
  return driverResults.some(r => r.source_type === 'test')
}

/**
 * Calculate domain confidence
 * 
 * Returns:
 * - Raw confidence value (0-100)
 * - Label (Low/Medium/High)
 * - Copy for UI
 */
export function calculateDomainConfidence(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>,
  allDriverConfigs: DriverConfig[],
  usingPrior: boolean
): {
  confidence: number
  label: 'Low' | 'Medium' | 'High'
  copy: string
} {
  // If using prior (no observations), confidence is minimal
  if (usingPrior) {
    return {
      confidence: 20, // Prior confidence
      label: 'Low',
      copy: CONFIDENCE_COPY.Low,
    }
  }
  
  // Filter to domain results (includes multi-domain drivers)
  const domainResults = driverResults.filter(r => {
    const config = driverConfigs.get(r.driver_key)
    return config && driverContributesToDomain(config, domain)
  })
  
  // Calculate present drivers
  const presentDriverKeys = new Set(domainResults.map(r => r.driver_key))
  
  // Calculate components
  const coverage = calculateCoverage(domain, presentDriverKeys, allDriverConfigs)
  const quality = calculateQuality(domainResults, driverConfigs)
  const freshness = calculateFreshness(domainResults, driverConfigs)
  const stability = calculateStability(domainResults, driverConfigs)
  
  // Combine using weights
  let rawConfidence = 100 * (
    CONFIDENCE_WEIGHTS.coverage * coverage +
    CONFIDENCE_WEIGHTS.quality * quality +
    CONFIDENCE_WEIGHTS.freshness * freshness +
    CONFIDENCE_WEIGHTS.stability * stability
  )
  
  // Apply domain-specific hard caps
  const cap = DOMAIN_CONFIDENCE_CAPS[domain]
  if (cap) {
    let shouldCap = false
    
    if (cap.condition === 'no_biomarker_values') {
      shouldCap = !hasBiomarkerValues(domain, domainResults)
    } else if (cap.condition === 'no_focus_test') {
      shouldCap = !hasFocusTest(domain, domainResults)
    }
    
    if (shouldCap) {
      rawConfidence = Math.min(rawConfidence, cap.cap)
    }
  }
  
  // Clamp to valid range
  const confidence = Math.max(0, Math.min(100, Math.round(rawConfidence)))
  
  const label = getConfidenceLabel(confidence)
  
  return {
    confidence,
    label,
    copy: CONFIDENCE_COPY[label],
  }
}

/**
 * Calculate overall Prime confidence
 * Average of domain confidences (or weighted if domain weights differ)
 */
export function calculatePrimeConfidence(
  domainConfidences: Record<PrimeDomain, number>,
  domainWeights: Record<PrimeDomain, number>
): number {
  let weightedSum = 0
  let totalWeight = 0
  
  for (const [domain, confidence] of Object.entries(domainConfidences)) {
    const weight = domainWeights[domain as PrimeDomain] ?? 0.2
    weightedSum += confidence * weight
    totalWeight += weight
  }
  
  if (totalWeight === 0) {
    return 50 // Default
  }
  
  return Math.round(weightedSum / totalWeight)
}

