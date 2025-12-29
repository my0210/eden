/**
 * Prime Scorecard Scoring Engine
 * 
 * Main entry point for computing Prime Scorecards.
 * This is a config-driven, deterministic scoring engine that:
 * - Always outputs 5 domain scores + Prime Score (0-100)
 * - Shows variable confidence based on evidence coverage/quality/freshness
 * - Handles mixed sources (self-report + device + labs)
 * - Uses driver-registry.json for all scoring behavior
 */

import { PrimeDomain, PRIME_DOMAINS } from '../types'
import {
  Observation,
  DriverConfig,
  DriverRegistry,
  DriverScoringResult,
  DomainScoringResult,
  ScorecardResult,
  DomainEvidenceSummary,
  DomainDerivedAtoms,
  RiskFlags,
  DEFAULT_DOMAIN_WEIGHTS,
  CONFIDENCE_COPY,
  getConfidenceLabel,
} from './types'
import {
  resolveBestObservation,
  detectConflict,
  groupObservationsByDriver,
  calculateFreshnessScore,
} from './resolve-observations'
import { scoreDriver, getBpCategory, isBpCrisis } from './driver-scorers'
import { calculateDomainScore, getFastestUpgradeAction, getMissingDrivers } from './domain-score'
import { calculateDomainConfidence, calculatePrimeConfidence } from './domain-confidence'

// Import the driver registry
import driverRegistryJson from './driver-registry.json'

/**
 * Load and parse the driver registry
 */
function loadDriverRegistry(): DriverRegistry {
  const registry = driverRegistryJson as DriverRegistry
  return registry
}

/**
 * Build a map of driver configs for quick lookup
 */
function buildDriverConfigMap(registry: DriverRegistry): Map<string, DriverConfig> {
  const map = new Map<string, DriverConfig>()
  for (const [key, config] of Object.entries(registry.drivers)) {
    map.set(key, config as DriverConfig)
  }
  return map
}

/**
 * Get all driver configs as an array
 */
function getAllDriverConfigs(registry: DriverRegistry): DriverConfig[] {
  return Object.values(registry.drivers) as DriverConfig[]
}

/**
 * Score all observations and produce driver results
 */
function scoreObservations(
  observations: Observation[],
  driverConfigs: Map<string, DriverConfig>,
  userContext?: { age?: number; sex?: string },
  now: Date = new Date()
): DriverScoringResult[] {
  const results: DriverScoringResult[] = []
  const grouped = groupObservationsByDriver(observations)
  
  for (const [driverKey, driverObs] of grouped) {
    const config = driverConfigs.get(driverKey)
    if (!config) {
      console.warn(`No config found for driver: ${driverKey}`)
      continue
    }
    
    // Resolve best observation
    const best = resolveBestObservation(driverObs, config)
    if (!best) continue
    
    // Score the observation
    const { score } = scoreDriver(best, config, userContext)
    
    // Calculate freshness
    const freshnessScore = calculateFreshnessScore(best, config.freshness_half_life_days, now)
    
    // Check for conflicts
    const conflictFlag = detectConflict(best, driverObs)
    
    results.push({
      driver_key: driverKey,
      driver_score: score,
      source_type: best.source_type,
      measured_at: best.measured_at,
      value: best.value,
      unit: best.unit,
      conflict_flag: conflictFlag || undefined,
      freshness_score: freshnessScore,
    })
  }
  
  return results
}

/**
 * Build evidence summary for a domain
 */
function buildEvidenceSummary(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>,
  allDriverConfigs: DriverConfig[]
): DomainEvidenceSummary {
  // Filter to domain results
  const domainResults = driverResults.filter(r => {
    const config = driverConfigs.get(r.driver_key)
    return config?.domain === domain
  })
  
  // Build drivers_used
  const driversUsed = domainResults.map(r => {
    const config = driverConfigs.get(r.driver_key)!
    return {
      driver_key: r.driver_key,
      display_name: config.display_name,
      source_type: r.source_type,
      measured_at: r.measured_at,
      has_value: true,
    }
  })
  
  // Build missing_drivers
  const presentKeys = new Set(domainResults.map(r => r.driver_key))
  const missing = getMissingDrivers(domain, presentKeys, allDriverConfigs)
  const missingDrivers = missing.map(config => ({
    driver_key: config.driver_key,
    display_name: config.display_name,
    missing_copy: config.missing_copy,
  }))
  
  // Get fastest upgrade action
  const fastestUpgradeAction = getFastestUpgradeAction(domain, presentKeys, allDriverConfigs)
  
  return {
    drivers_used: driversUsed,
    missing_drivers: missingDrivers,
    fastest_upgrade_action: fastestUpgradeAction,
  }
}

/**
 * Derive atoms for coach context
 */
function deriveDomainAtoms(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[],
  observations: Observation[]
): DomainDerivedAtoms {
  const atoms: DomainDerivedAtoms = {}
  
  // Filter to domain results
  const domainObs = observations.filter(o => {
    // Check if this observation's driver belongs to this domain
    const registry = loadDriverRegistry()
    const config = registry.drivers[o.driver_key] as DriverConfig | undefined
    return config?.domain === domain
  })
  
  switch (domain) {
    case 'heart': {
      // BP category
      const bpObs = domainObs.find(o => o.driver_key === 'bp')
      if (bpObs && typeof bpObs.value === 'number') {
        atoms.bp_category = getBpCategory(bpObs.value)
        atoms.bp_crisis_flag = isBpCrisis(bpObs.value)
      }
      
      // Cardio self-rating
      const cardioObs = domainObs.find(o => o.driver_key === 'cardio_fitness')
      if (cardioObs) {
        atoms.cardio_self_rating_bucket = String(cardioObs.value)
      }
      
      // RHR bucket
      const rhrObs = domainObs.find(o => o.driver_key === 'rhr')
      if (rhrObs && typeof rhrObs.value === 'number') {
        atoms.rhr_bucket = `${rhrObs.value} bpm`
      }
      
      // Missing action
      const presentDrivers = new Set(driverResults.map(r => r.driver_key))
      if (!presentDrivers.has('bp') && !domainObs.some(o => o.source_type === 'device')) {
        atoms.heart_missing_top_action = 'Add blood pressure'
      } else if (!domainObs.some(o => o.source_type === 'device')) {
        atoms.heart_missing_top_action = 'Connect Apple Health'
      }
      break
    }
    
    case 'frame': {
      // Waist-to-height
      const wthObs = domainObs.find(o => o.driver_key === 'waist_to_height')
      if (wthObs && typeof wthObs.value === 'number') {
        atoms.waist_to_height = wthObs.value
      }
      
      // Strength bucket
      const pushupObs = domainObs.find(o => o.driver_key === 'pushups')
      if (pushupObs) {
        atoms.strength_bucket = String(pushupObs.value)
      }
      
      // Limitation flag
      const painObs = domainObs.find(o => o.driver_key === 'pain_limitation')
      if (painObs) {
        atoms.limitation_flag = painObs.value === 'moderate' || painObs.value === 'severe'
      }
      break
    }
    
    case 'metabolism': {
      // Labs present
      const labDrivers = ['hba1c', 'apob', 'hscrp']
      atoms.labs_present = domainObs.some(o => 
        labDrivers.includes(o.driver_key) && o.source_type === 'lab'
      )
      
      // Risk flags (derived from metabolic_risk driver)
      const riskObs = domainObs.find(o => o.driver_key === 'metabolic_risk')
      if (riskObs) {
        const value = String(riskObs.value)
        atoms.met_risk_flags = value !== 'no_risk' ? [value] : []
        atoms.managed_with_meds = false // Would need to check medications separately
      }
      break
    }
    
    case 'recovery': {
      // Sleep bucket
      const sleepObs = domainObs.find(o => o.driver_key === 'sleep_duration')
      if (sleepObs) {
        atoms.sleep_bucket = String(sleepObs.value)
      }
      
      // Regularity flag
      const regObs = domainObs.find(o => o.driver_key === 'sleep_regularity')
      if (regObs) {
        atoms.regularity_flag = regObs.value === 'true' || regObs.value === true
      }
      
      // Insomnia bucket
      const insomniaObs = domainObs.find(o => o.driver_key === 'insomnia')
      if (insomniaObs) {
        atoms.insomnia_bucket = String(insomniaObs.value)
      }
      break
    }
    
    case 'mind': {
      // Mind test present (PVT-lite)
      atoms.mind_test_present = domainObs.some(o => o.source_type === 'test')
      
      // Focus bucket
      const focusObs = domainObs.find(o => o.driver_key === 'focus_stability')
      if (focusObs) {
        atoms.focus_bucket = String(focusObs.value)
      }
      
      // Fog bucket
      const fogObs = domainObs.find(o => o.driver_key === 'brain_fog')
      if (fogObs) {
        atoms.fog_bucket = String(fogObs.value)
      }
      break
    }
  }
  
  return atoms
}

/**
 * Extract risk flags from observations
 */
function extractRiskFlags(
  observations: Observation[],
  driverResults: DriverScoringResult[]
): RiskFlags {
  const flags: RiskFlags = {}
  
  // BP crisis flag
  const bpObs = observations.find(o => o.driver_key === 'bp')
  if (bpObs && typeof bpObs.value === 'number') {
    flags.bp_crisis_flag = isBpCrisis(bpObs.value)
  }
  
  // Severe pain flag
  const painObs = observations.find(o => o.driver_key === 'pain_limitation')
  if (painObs) {
    flags.severe_pain_flag = painObs.value === 'severe'
  }
  
  // Diabetes flag
  const riskObs = observations.find(o => o.driver_key === 'metabolic_risk')
  if (riskObs) {
    flags.diabetes_flag = String(riskObs.value).includes('diabetes')
  }
  
  return flags
}

/**
 * Build "how calculated" explanations for each domain
 */
function buildHowCalculated(
  domain: PrimeDomain,
  driverResults: DriverScoringResult[],
  driverConfigs: Map<string, DriverConfig>,
  usingPrior: boolean
): string[] {
  const explanations: string[] = []
  
  if (usingPrior) {
    explanations.push('Based on population averages (no specific data provided)')
    return explanations
  }
  
  // Filter to domain results
  const domainResults = driverResults.filter(r => {
    const config = driverConfigs.get(r.driver_key)
    return config?.domain === domain
  })
  
  for (const result of domainResults) {
    const config = driverConfigs.get(result.driver_key)
    if (!config) continue
    
    const sourceLabel = config.evidence_label_map?.[result.source_type] ?? result.source_type
    explanations.push(
      `${config.display_name}: ${sourceLabel} (score: ${Math.round(result.driver_score)})`
    )
  }
  
  return explanations
}

/**
 * Main scoring function
 * 
 * Takes observations and produces a complete scorecard result
 */
export function computeScorecard(
  observations: Observation[],
  userContext?: { age?: number; sex?: string },
  now: Date = new Date()
): ScorecardResult {
  const registry = loadDriverRegistry()
  const driverConfigs = buildDriverConfigMap(registry)
  const allDriverConfigs = getAllDriverConfigs(registry)
  const domainWeights = registry.domain_weights ?? DEFAULT_DOMAIN_WEIGHTS
  
  // Score all observations
  const driverResults = scoreObservations(observations, driverConfigs, userContext, now)
  
  // Build domain results
  const domainResults: Record<PrimeDomain, DomainScoringResult> = {} as Record<PrimeDomain, DomainScoringResult>
  const domainScores: Record<PrimeDomain, number> = {} as Record<PrimeDomain, number>
  const domainConfidences: Record<PrimeDomain, number> = {} as Record<PrimeDomain, number>
  const howCalculated: Record<PrimeDomain, string[]> = {} as Record<PrimeDomain, string[]>
  
  for (const domain of PRIME_DOMAINS) {
    // Calculate domain score
    const { score: domainScore, usingPrior } = calculateDomainScore(
      domain,
      driverResults,
      driverConfigs,
      userContext
    )
    domainScores[domain] = domainScore
    
    // Calculate domain confidence
    const { confidence, label, copy } = calculateDomainConfidence(
      domain,
      driverResults,
      driverConfigs,
      allDriverConfigs,
      usingPrior
    )
    domainConfidences[domain] = confidence
    
    // Build evidence summary
    const evidenceSummary = buildEvidenceSummary(
      domain,
      driverResults,
      driverConfigs,
      allDriverConfigs
    )
    
    // Derive atoms
    const derivedAtoms = deriveDomainAtoms(domain, driverResults, observations)
    
    // Extract risk flags
    const riskFlags = extractRiskFlags(observations, driverResults)
    
    // Build how calculated
    howCalculated[domain] = buildHowCalculated(domain, driverResults, driverConfigs, usingPrior)
    
    // Filter domain driver results
    const domainDriverResults = driverResults.filter(r => {
      const config = driverConfigs.get(r.driver_key)
      return config?.domain === domain
    })
    
    domainResults[domain] = {
      domain,
      domain_score: domainScore,
      domain_confidence: confidence,
      confidence_label: label,
      confidence_copy: copy,
      evidence_summary: evidenceSummary,
      risk_flags: riskFlags,
      derived_atoms: derivedAtoms,
      driver_results: domainDriverResults,
      using_prior: usingPrior,
    }
  }
  
  // Calculate Prime Score (weighted mean of domain scores)
  let primeScore = 0
  for (const domain of PRIME_DOMAINS) {
    primeScore += domainWeights[domain] * domainScores[domain]
  }
  primeScore = Math.round(primeScore * 10) / 10
  
  // Calculate Prime Confidence
  const primeConfidence = calculatePrimeConfidence(domainConfidences, domainWeights)
  
  return {
    generated_at: now.toISOString(),
    prime_score: primeScore,
    prime_confidence: primeConfidence,
    domain_results: domainResults,
    how_calculated: howCalculated,
    scoring_revision: 'v3.0.0', // Update when scoring logic changes
  }
}

/**
 * Re-export types for consumers
 */
export * from './types'
export { calculateBmi, calculateWaistToHeight, deriveMetabolicRiskCategory } from './driver-scorers'

