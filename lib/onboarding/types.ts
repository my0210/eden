/**
 * Prime Check Onboarding Types (v3)
 * 
 * These types define the structure for Prime Check answers collected during onboarding.
 * This data is stored in eden_user_state.prime_check_json and used by the scoring engine.
 * 
 * IMPORTANT: When changing questions, increment the schema_version in PrimeCheckJson.
 */

// ============================================================================
// Heart Domain Types
// ============================================================================

export type CardioSelfRating = 
  | 'below_avg' 
  | 'slightly_below' 
  | 'average' 
  | 'slightly_above' 
  | 'above_avg' 
  | 'not_sure'

export type RhrRange = '<55' | '55-64' | '65-74' | '75-84' | '85+'

export type RhrSource = 'wearable' | 'doctor' | 'other'

export interface BloodPressureEntry {
  systolic: number
  diastolic: number
  measured_date: string // YYYY-MM format
}

export interface RestingHeartRateEntry {
  bpm?: number // exact value if known
  range?: RhrRange // range if exact unknown
  measured_date?: string // YYYY-MM, optional
  source?: RhrSource // optional
}

export interface HeartPrimeCheck {
  // Quick check (required)
  cardio_self_rating?: CardioSelfRating
  // Measurements (optional)
  blood_pressure?: BloodPressureEntry
  resting_heart_rate?: RestingHeartRateEntry
}

// ============================================================================
// Frame Domain Types
// ============================================================================

export type PushupCapability = '0-5' | '6-15' | '16-30' | '31+' | 'not_possible'

export type MidsectionAdiposityLevel = 'low' | 'moderate' | 'high'

// ----- Structural Integrity v1 Questionnaire -----

/** SI1: Limitation severity (required) */
export type LimitationSeverity = 'none' | 'mild' | 'moderate' | 'severe'

/** SI2: Location of limitation (conditional, max 2) */
export type LimitationArea = 
  | 'back_low' 
  | 'knee' 
  | 'shoulder' 
  | 'neck_upper' 
  | 'hip' 
  | 'ankle_foot' 
  | 'wrist_elbow' 
  | 'other'

/** SI3: Duration/pattern of limitation */
export type LimitationDuration = 'new_2w' | 'recent_6w' | 'ongoing_6plus' | 'intermittent'

/** SI4 (optional): Stiffness frequency */
export type StiffnessFrequency = 'rarely' | 'sometimes' | 'often'

/**
 * Complete Structural Integrity assessment
 */
export interface StructuralIntegrityEntry {
  /** SI1: Limitation severity (required) */
  severity: LimitationSeverity
  /** SI2: Affected areas (conditional on severity != 'none', max 2) */
  areas?: LimitationArea[]
  /** SI3: Duration pattern (conditional on severity != 'none') */
  duration?: LimitationDuration
  /** SI4: Stiffness frequency (optional universal) */
  stiffness?: StiffnessFrequency
}

// Legacy type for backward compatibility
export type PainLimitation = 'none' | 'mild' | 'moderate' | 'severe'

/**
 * Photo analysis results from body photo analyzer
 */
export interface PhotoAnalysisResult {
  /** UUID of the photo upload record */
  upload_id: string
  /** Body fat percentage range (direct from image) → body_fat driver */
  body_fat_range?: { low: number; high: number }
  /** Midsection adiposity level (direct from image) → waist_to_height proxy */
  midsection_adiposity?: MidsectionAdiposityLevel
  /** Lean body mass range in kg (derived from weight + body fat) → lean_mass driver */
  lean_mass_range_kg?: { low: number; high: number }
  /** ISO timestamp when analysis was performed */
  analyzed_at: string
}

export interface FramePrimeCheck {
  // Quick check (required)
  pushup_capability?: PushupCapability
  // Structural Integrity (new v1 questionnaire)
  structural_integrity?: StructuralIntegrityEntry
  // Legacy field (for backward compat, deprecated)
  pain_limitation?: PainLimitation
  // Measurement (optional)
  waist_cm?: number
  waist_measured_correctly?: boolean
  // Photo analysis (optional)
  photo_analysis?: PhotoAnalysisResult
}

// ============================================================================
// Metabolism Domain Types
// ============================================================================

export type MetabolismDiagnosis = 
  | 'none'
  | 'unsure'
  | 'prediabetes'
  | 'diabetes'
  | 'high_cholesterol'
  | 'high_apob'
  | 'high_ldl'
  | 'fatty_liver'
  | 'high_blood_pressure'

export type FamilyHistory = 
  | 'none'
  | 'unsure'
  | 'early_heart_disease'
  | 'type2_diabetes'

export type MetabolismMedication = 
  | 'none'
  | 'statin'
  | 'metformin'
  | 'glp1'
  | 'other'

export interface LabsEntry {
  apob_mg_dl?: number
  hba1c_percent?: number
  hscrp_mg_l?: number
  alt?: number
  ast?: number
  ggt?: number
  test_date?: string // YYYY-MM format
}

export interface MetabolismPrimeCheck {
  // Quick checks (required)
  diagnoses?: MetabolismDiagnosis[]
  family_history?: FamilyHistory[]
  medications?: MetabolismMedication[]
  // Labs (optional but primary value path)
  labs?: LabsEntry
}

// ============================================================================
// Recovery Domain Types
// ============================================================================

export type SleepDuration = '<6h' | '6-7h' | '7-8h' | '8h+'

export type InsomniaFrequency = '<1' | '1-2' | '3-4' | '5+'

export interface RecoveryPrimeCheck {
  // Quick checks (required)
  sleep_duration?: SleepDuration
  sleep_regularity?: boolean
  insomnia_frequency?: InsomniaFrequency
}

// ============================================================================
// Mind Domain Types
// ============================================================================

export type FocusStability = 
  | 'very_unstable' 
  | 'somewhat_unstable' 
  | 'mostly_stable' 
  | 'very_stable'

export type BrainFogFrequency = 'rarely' | 'sometimes' | 'often'

export interface MindPrimeCheck {
  // Quick checks (fallback, since PVT-lite deferred)
  focus_stability?: FocusStability
  brain_fog?: BrainFogFrequency
}

// ============================================================================
// Complete Prime Check JSON Structure
// ============================================================================

/**
 * Complete Prime Check JSON stored in eden_user_state.prime_check_json
 * 
 * This structure collects all onboarding answers for the Prime Check step (Step 5).
 * The scoring engine converts these into Observations for score calculation.
 */
export interface PrimeCheckJson {
  heart?: HeartPrimeCheck
  frame?: FramePrimeCheck
  metabolism?: MetabolismPrimeCheck
  recovery?: RecoveryPrimeCheck
  mind?: MindPrimeCheck
  
  // Metadata
  /** Schema version for migration safety - increment when questions change */
  schema_version: number
  /** ISO timestamp when Prime Check was completed */
  completed_at?: string
}

/**
 * Current schema version for Prime Check
 * Increment this when questions change in a backward-incompatible way
 */
export const PRIME_CHECK_SCHEMA_VERSION = 1

