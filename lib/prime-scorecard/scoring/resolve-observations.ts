/**
 * Observation Resolution
 * 
 * Resolves multiple observations for a driver to a single "best" observation
 * based on source priority and freshness.
 */

import {
  Observation,
  DriverConfig,
  DEFAULT_SOURCE_PRIORITY,
  SourceType,
} from './types'

/**
 * Get the priority index of a source type (lower = higher priority)
 */
function getSourcePriority(
  sourceType: SourceType,
  priorityOrder: SourceType[]
): number {
  const index = priorityOrder.indexOf(sourceType)
  return index === -1 ? priorityOrder.length : index
}

/**
 * Compare two observations and determine which is better
 * 
 * Rules:
 * 1. Higher-tier source wins (lab > device > self_report)
 * 2. Within same tier, prefer more recent
 * 
 * @returns negative if a is better, positive if b is better, 0 if equal
 */
function compareObservations(
  a: Observation,
  b: Observation,
  priorityOrder: SourceType[]
): number {
  const aPriority = getSourcePriority(a.source_type, priorityOrder)
  const bPriority = getSourcePriority(b.source_type, priorityOrder)
  
  // Lower priority index = better source
  if (aPriority !== bPriority) {
    return aPriority - bPriority
  }
  
  // Same source tier, compare timestamps (more recent = better)
  const aTime = new Date(a.measured_at).getTime()
  const bTime = new Date(b.measured_at).getTime()
  
  // Higher time = more recent = better, so b - a
  return bTime - aTime
}

/**
 * Resolve observations for a single driver to the best one
 * 
 * @param observations - All observations for this driver
 * @param driverConfig - Configuration for the driver
 * @returns The best observation, or null if no observations
 */
export function resolveBestObservation(
  observations: Observation[],
  driverConfig: DriverConfig
): Observation | null {
  if (observations.length === 0) {
    return null
  }
  
  const priorityOrder = driverConfig.source_priority ?? DEFAULT_SOURCE_PRIORITY
  
  // Sort observations by quality (best first)
  const sorted = [...observations].sort((a, b) => 
    compareObservations(a, b, priorityOrder)
  )
  
  return sorted[0]
}

/**
 * Check if there's a conflict between observations
 * A conflict occurs when a lower-tier observation differs significantly
 * from a higher-tier one
 * 
 * @param best - The resolved best observation
 * @param all - All observations for the driver
 * @param threshold - Percentage difference to consider a conflict (default 10%)
 */
export function detectConflict(
  best: Observation,
  all: Observation[],
  threshold: number = 0.1
): boolean {
  if (all.length <= 1) {
    return false
  }
  
  // Only check numeric values for conflicts
  if (typeof best.value !== 'number') {
    return false
  }
  
  for (const obs of all) {
    if (obs === best) continue
    if (typeof obs.value !== 'number') continue
    
    const diff = Math.abs(obs.value - best.value) / best.value
    if (diff > threshold) {
      return true
    }
  }
  
  return false
}

/**
 * Group observations by driver key
 */
export function groupObservationsByDriver(
  observations: Observation[]
): Map<string, Observation[]> {
  const groups = new Map<string, Observation[]>()
  
  for (const obs of observations) {
    const existing = groups.get(obs.driver_key) ?? []
    existing.push(obs)
    groups.set(obs.driver_key, existing)
  }
  
  return groups
}

/**
 * Calculate freshness score for an observation
 * Uses exponential decay: freshness = exp(-ln(2) * age_days / half_life_days)
 * 
 * @param observation - The observation to evaluate
 * @param halfLifeDays - Half-life in days from driver config
 * @param now - Reference time (defaults to current time)
 */
export function calculateFreshnessScore(
  observation: Observation,
  halfLifeDays: number,
  now: Date = new Date()
): number {
  const measureDate = new Date(observation.measured_at)
  const ageDays = (now.getTime() - measureDate.getTime()) / (1000 * 60 * 60 * 24)
  
  if (ageDays <= 0) {
    return 1.0
  }
  
  // Exponential decay: exp(-ln(2) * age / half_life)
  const decay = Math.exp(-Math.LN2 * ageDays / halfLifeDays)
  
  return Math.max(0, Math.min(1, decay))
}

