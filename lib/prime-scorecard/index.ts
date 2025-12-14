/**
 * Prime Scorecard Module
 * 
 * This module defines the Prime Scorecard contract, canonical metrics,
 * source mappings, and computation engine. It is the single source of truth for:
 * - Scorecard shape and validation
 * - Expected metrics per domain
 * - Data source mappings (Apple Health, photos, self-report)
 * - Scorecard computation logic
 * 
 * IMPORTANT: Do not define metrics or scorecard types elsewhere.
 * Import from this module instead.
 */

// Types and contract
export * from './types'
export * from './contract'
export * from './validate'

// Metrics (single source of truth)
export * from './metrics'

// Source mappings
export * from './mapping'

// Inputs loader
export * from './inputs'

// Contribution mapping (internal scoring)
export * from './metricContribution'

// Scorecard computation
export * from './compute'

