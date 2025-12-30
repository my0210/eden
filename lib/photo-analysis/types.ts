/**
 * Photo Analysis Types
 * 
 * Types for the body photo analyzer using OpenAI Vision.
 * Extracts body fat range and midsection adiposity for Frame domain scoring.
 */

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Reasons why a photo might be rejected
 */
export type PhotoRejectionReason =
  | 'not_full_body'
  | 'multiple_people'
  | 'too_blurry'
  | 'too_dark'
  | 'inappropriate_content'
  | 'appears_minor'
  | 'other'

/**
 * Result of photo validation (Stage 1)
 */
export interface PhotoValidationResult {
  valid: boolean
  rejection_reason?: PhotoRejectionReason
  /** Friendly, non-judgmental message for the user */
  user_message?: string
}

/**
 * User-facing messages for different rejection reasons
 */
export const REJECTION_MESSAGES: Record<PhotoRejectionReason, string> = {
  not_full_body: 'Please upload a photo showing your full body for accurate analysis.',
  multiple_people: 'Please upload a photo with only yourself visible.',
  too_blurry: 'The photo quality isn\'t clear enough. Try better lighting or a steadier shot.',
  too_dark: 'The photo is too dark. Please try again with better lighting.',
  inappropriate_content: 'Please upload a photo with appropriate clothing.',
  appears_minor: 'For safety reasons, we cannot analyze photos that appear to show minors.',
  other: 'We couldn\'t analyze this photo. Please try a different one.',
}

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Midsection adiposity levels (central fat distribution)
 * Maps to waist_to_height proxy values
 */
export type MidsectionAdiposityLevel = 'low' | 'moderate' | 'high'

/**
 * Mapping from midsection adiposity to estimated waist-to-height ratio
 */
export const MIDSECTION_TO_WHR: Record<MidsectionAdiposityLevel, number> = {
  low: 0.42,      // healthy range
  moderate: 0.52, // borderline
  high: 0.58,     // elevated risk
}

/**
 * Unable to estimate result
 */
export interface UnableToEstimate {
  unable_to_estimate: true
  reason: string
}

/**
 * Generic type for estimate or unable to estimate
 */
export type EstimateOrUnable<T> = T | UnableToEstimate

/**
 * Check if result is unable to estimate
 */
export function isUnableToEstimate<T>(result: EstimateOrUnable<T>): result is UnableToEstimate {
  return typeof result === 'object' && result !== null && 'unable_to_estimate' in result
}

/**
 * Body fat estimate from photo
 */
export interface BodyFatEstimate {
  range_low: number   // e.g., 15
  range_high: number  // e.g., 20
}

/**
 * Midsection adiposity estimate from photo
 */
export interface MidsectionAdiposityEstimate {
  level: MidsectionAdiposityLevel
}

/**
 * What the LLM returns directly from image analysis
 */
export interface BodyPhotoAnalysis {
  validation: PhotoValidationResult
  
  // Only present if validation.valid === true
  body_fat_estimate?: EstimateOrUnable<BodyFatEstimate>
  midsection_adiposity?: EstimateOrUnable<MidsectionAdiposityEstimate>
  
  analysis_version: string
  analyzed_at: string
}

// ============================================================================
// Derived Types (computed from analysis + user data)
// ============================================================================

/**
 * Derived values computed from image + user data (weight required)
 */
export interface DerivedFromPhoto {
  /**
   * Lean body mass estimate
   * Calculated as: weight × (1 - body_fat/100)
   */
  lean_mass_estimate_kg?: {
    range_low: number   // weight_kg × (1 - body_fat_high/100)
    range_high: number  // weight_kg × (1 - body_fat_low/100)
  }
}

/**
 * Calculate lean body mass from weight and body fat estimate
 */
export function calculateLeanMass(
  weightKg: number,
  bodyFatEstimate: BodyFatEstimate
): { range_low: number; range_high: number } {
  return {
    range_low: Math.round(weightKg * (1 - bodyFatEstimate.range_high / 100) * 10) / 10,
    range_high: Math.round(weightKg * (1 - bodyFatEstimate.range_low / 100) * 10) / 10,
  }
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Successful analysis response
 */
export interface PhotoAnalysisSuccess {
  success: true
  upload_id: string
  analysis: BodyPhotoAnalysis
  derived?: DerivedFromPhoto
}

/**
 * Failed analysis response
 */
export interface PhotoAnalysisFailure {
  success: false
  error: 'validation_failed' | 'analysis_error' | 'upload_error' | 'auth_error'
  user_message: string
}

/**
 * Photo analysis API response
 */
export type PhotoAnalysisResponse = PhotoAnalysisSuccess | PhotoAnalysisFailure

// ============================================================================
// Storage Types (what gets stored in eden_photo_uploads.metadata_json)
// ============================================================================

/**
 * Metadata stored with photo upload
 */
export interface PhotoUploadMetadata {
  /** Source of upload (onboarding, data_page) */
  source: string
  /** Analysis results (if successful) */
  analysis?: BodyPhotoAnalysis
  /** Derived values (if weight available) */
  derived?: DerivedFromPhoto
  /** User's weight at time of analysis (for recalculation) */
  weight_kg?: number
  /** Analysis error (if failed) */
  error?: string
}

