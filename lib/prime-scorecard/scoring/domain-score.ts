/**
 * Domain Score Calculation
 * 
 * Computes domain scores from driver scores using:
 * - Weight reallocation for missing drivers
 * - Dominance caps to prevent single driver from dominating
 * - Prior scores when no observations exist
 * - Multi-domain drivers (one driver can contribute to multiple domains)
 */

import { PrimeDomain } from '../types'
import { DriverConfig, DriverScoringResult, getDriverDomainContributions, DomainContribution } from './types'

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
 * Check if a fallback driver should be suppressed
 * Returns true if the driver has `suppress_if_present` and any of those drivers are present
 */
export function shouldSuppressDriver(
  config: DriverConfig,
  presentDriverKeys: Set<string>
): boolean {
  if (!config.fallback_only || !config.suppress_if_present) {
    return false
  }
  // Suppress if ANY of the suppress_if_present drivers are present
  return config.suppress_if_present.some(key => presentDriverKeys.has(key))
}

/**
 * Calculate domain score from driver results
 * 
 * Formula:
 * 1. Let A = set of drivers with scores present
 * 2. If A is empty, return prior score
 * 3. Filter out fallback drivers if their primary drivers are present
 * 4. Reallocate weights: w_i_tmp = w_i / sum(w_j for j in A)
 * 5. Apply dominance cap: w_i_capped = min(w_i_tmp, cap_i)
 * 6. Renormalize: w_i_final = w_i_capped / sum(w_k_capped for k in A)
 * 7. DomainScore = sum(w_i_final * s_i for i in A)
 */
export function calculateDomainScore(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>,
  userProfile?: { age?: number; sex?: string }
): { score: number; usingPrior: boolean } {
  // Filter to results for this domain (includes multi-domain drivers)
  let domainResults = driverResults.filter(r => {
    const config = driverConfigs.get(r.driver_key)
    return config && driverContributesToDomain(config, domain)
  })
  
  // Build set of present driver keys for suppression check
  const presentDriverKeys = new Set(domainResults.map(r => r.driver_key))
  
  // Filter out fallback drivers when their primary drivers are present
  domainResults = domainResults.filter(r => {
    const config = driverConfigs.get(r.driver_key)
    if (!config) return false
    return !shouldSuppressDriver(config, presentDriverKeys)
  })
  
  // Case 2: No observations - use prior
  if (domainResults.length === 0) {
    return {
      score: getPriorScore(domain, userProfile),
      usingPrior: true,
    }
  }
  
  // Step 3: Raw reallocation
  // Sum of configured weights for available drivers (using domain-specific weights)
  let totalConfiguredWeight = 0
  for (const result of domainResults) {
    const config = driverConfigs.get(result.driver_key)
    if (config) {
      const contribution = getDomainContribution(config, domain)
      if (contribution) {
        totalConfiguredWeight += contribution.weight
      }
    }
  }
  
  if (totalConfiguredWeight === 0) {
    return {
      score: getPriorScore(domain, userProfile),
      usingPrior: true,
    }
  }
  
  // Calculate reallocated weights (using domain-specific weights)
  const reallocatedWeights = new Map<string, number>()
  for (const result of domainResults) {
    const config = driverConfigs.get(result.driver_key)
    if (config) {
      const contribution = getDomainContribution(config, domain)
      if (contribution) {
        const wTmp = contribution.weight / totalConfiguredWeight
        reallocatedWeights.set(result.driver_key, wTmp)
      }
    }
  }
  
  // Step 4: Apply dominance caps (using domain-specific caps)
  const cappedWeights = new Map<string, number>()
  for (const result of domainResults) {
    const config = driverConfigs.get(result.driver_key)
    const reallocated = reallocatedWeights.get(result.driver_key) ?? 0
    if (config) {
      const contribution = getDomainContribution(config, domain)
      const cap = contribution?.dominance_cap ?? 1.0
      const capped = Math.min(reallocated, cap)
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
 * Excludes fallback drivers when their primary drivers are present
 */
export function getMissingDrivers(
  domain: PrimeDomain,
  presentDriverKeys: Set<string>,
  allDriverConfigs: DriverConfig[]
): DriverConfig[] {
  return allDriverConfigs.filter(config => {
    // Must be in this domain and not present
    if (!driverContributesToDomain(config, domain)) return false
    if (presentDriverKeys.has(config.driver_key)) return false
    
    // Don't show fallback drivers as "missing" if their primary drivers are present
    // e.g., don't say "BMI is missing" if body_fat is present
    if (config.fallback_only && config.suppress_if_present) {
      const hasPrimary = config.suppress_if_present.some(key => presentDriverKeys.has(key))
      if (hasPrimary) return false
    }
    
    return true
  })
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
  
  // Sort by domain-specific weight (highest impact first)
  const sorted = [...missing].sort((a, b) => {
    const aContrib = getDomainContribution(a, domain)
    const bContrib = getDomainContribution(b, domain)
    const aWeight = aContrib?.weight ?? a.weight ?? 0
    const bWeight = bContrib?.weight ?? b.weight ?? 0
    return bWeight - aWeight
  })
  
  return sorted[0].missing_copy
}

