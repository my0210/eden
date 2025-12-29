/**
 * Domain Score Calculation
 * 
 * Computes domain scores from driver scores using:
 * - Weight reallocation for missing drivers
 * - Dominance caps to prevent single driver from dominating
 * - Prior scores when no observations exist
 */

import { PrimeDomain } from '../types'
import { DriverConfig, DriverScoringResult } from './types'

/**
 * Default prior scores by domain
 * Used when no observations exist for a domain
 * Neutral (~50), adjusted conservatively by demographics if desired
 */
const PRIOR_DOMAIN_SCORES: Record<PrimeDomain, number> = {
  heart: 50,
  frame: 50,
  metabolism: 55, // Slightly higher prior - assume healthy if no evidence
  recovery: 50,
  mind: 50,
}

/**
 * Calculate domain score from driver results
 * 
 * Formula:
 * 1. Let A = set of drivers with scores present
 * 2. If A is empty, return prior score
 * 3. Reallocate weights: w_i_tmp = w_i / sum(w_j for j in A)
 * 4. Apply dominance cap: w_i_capped = min(w_i_tmp, cap_i)
 * 5. Renormalize: w_i_final = w_i_capped / sum(w_k_capped for k in A)
 * 6. DomainScore = sum(w_i_final * s_i for i in A)
 */
export function calculateDomainScore(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>,
  userProfile?: { age?: number; sex?: string }
): { score: number; usingPrior: boolean } {
  // Filter to results for this domain
  const domainResults = driverResults.filter(r => {
    const config = driverConfigs.get(r.driver_key)
    return config?.domain === domain
  })
  
  // Case 2: No observations - use prior
  if (domainResults.length === 0) {
    return {
      score: getPriorScore(domain, userProfile),
      usingPrior: true,
    }
  }
  
  // Step 3: Raw reallocation
  // Sum of configured weights for available drivers
  let totalConfiguredWeight = 0
  for (const result of domainResults) {
    const config = driverConfigs.get(result.driver_key)
    if (config) {
      totalConfiguredWeight += config.weight
    }
  }
  
  if (totalConfiguredWeight === 0) {
    return {
      score: getPriorScore(domain, userProfile),
      usingPrior: true,
    }
  }
  
  // Calculate reallocated weights
  const reallocatedWeights = new Map<string, number>()
  for (const result of domainResults) {
    const config = driverConfigs.get(result.driver_key)
    if (config) {
      const wTmp = config.weight / totalConfiguredWeight
      reallocatedWeights.set(result.driver_key, wTmp)
    }
  }
  
  // Step 4: Apply dominance caps
  const cappedWeights = new Map<string, number>()
  for (const result of domainResults) {
    const config = driverConfigs.get(result.driver_key)
    const reallocated = reallocatedWeights.get(result.driver_key) ?? 0
    if (config) {
      const capped = Math.min(reallocated, config.dominance_cap)
      cappedWeights.set(result.driver_key, capped)
    }
  }
  
  // Step 5: Renormalize capped weights
  let totalCappedWeight = 0
  for (const weight of cappedWeights.values()) {
    totalCappedWeight += weight
  }
  
  const finalWeights = new Map<string, number>()
  for (const [key, capped] of cappedWeights) {
    finalWeights.set(key, totalCappedWeight > 0 ? capped / totalCappedWeight : 0)
  }
  
  // Step 6: Compute weighted sum
  let domainScore = 0
  for (const result of domainResults) {
    const weight = finalWeights.get(result.driver_key) ?? 0
    domainScore += weight * result.driver_score
  }
  
  return {
    score: Math.round(domainScore * 10) / 10, // Round to 1 decimal
    usingPrior: false,
  }
}

/**
 * Get prior score for a domain
 * Can be adjusted by age/sex for more realistic priors
 */
export function getPriorScore(
  domain: PrimeDomain,
  userProfile?: { age?: number; sex?: string }
): number {
  const basePrior = PRIOR_DOMAIN_SCORES[domain]
  
  // Optional: Adjust prior based on demographics
  // For v1, keep it simple and return base prior
  if (!userProfile?.age) {
    return basePrior
  }
  
  // Small age adjustment (older = slightly lower prior for physical domains)
  let ageAdjustment = 0
  if (domain === 'heart' || domain === 'frame' || domain === 'recovery') {
    if (userProfile.age >= 60) {
      ageAdjustment = -5
    } else if (userProfile.age >= 50) {
      ageAdjustment = -3
    }
  }
  
  return Math.max(30, Math.min(70, basePrior + ageAdjustment))
}

/**
 * Calculate which drivers are missing for a domain
 */
export function getMissingDrivers(
  domain: PrimeDomain,
  presentDriverKeys: Set<string>,
  allDriverConfigs: DriverConfig[]
): DriverConfig[] {
  return allDriverConfigs.filter(config => 
    config.domain === domain && !presentDriverKeys.has(config.driver_key)
  )
}

/**
 * Get the fastest upgrade action for a domain
 * Returns the most impactful missing driver's action copy
 */
export function getFastestUpgradeAction(
  domain: PrimeDomain,
  presentDriverKeys: Set<string>,
  allDriverConfigs: DriverConfig[]
): string | null {
  const missing = getMissingDrivers(domain, presentDriverKeys, allDriverConfigs)
  
  if (missing.length === 0) {
    return null
  }
  
  // Sort by weight (highest impact first)
  const sorted = [...missing].sort((a, b) => b.weight - a.weight)
  
  return sorted[0].missing_copy
}

