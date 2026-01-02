/**
 * Prime Check Converter
 * 
 * Converts PrimeCheckJson data to Observations for the scoring engine.
 * This bridges the gap between onboarding form data and the scoring engine.
 */

import {
  PrimeCheckJson,
  BloodPressureEntry,
  RestingHeartRateEntry,
  PhotoAnalysisResult,
  StructuralIntegrityEntry,
  LimitationSeverity,
  FocusCheckResult,
} from '@/lib/onboarding/types'
import { Observation, SourceType } from './types'
import { calculateWaistToHeight, calculateBmi, deriveMetabolicRiskCategory } from './driver-scorers'

/**
 * Mapping from midsection adiposity to estimated waist-to-height ratio
 */
const MIDSECTION_TO_WHR: Record<string, number> = {
  'low': 0.42,      // healthy range
  'moderate': 0.52, // borderline
  'high': 0.58,     // elevated risk
}

/**
 * Get the middle value of an RHR range
 */
function getRhrMidpoint(range: string): number {
  switch (range) {
    case '<55': return 52
    case '55-64': return 60
    case '65-74': return 70
    case '75-84': return 80
    case '85+': return 90
    default: return 70
  }
}

/**
 * Convert a date string to ISO timestamp
 * Handles YYYY-MM format from forms
 */
function toIsoTimestamp(dateStr: string | undefined): string {
  if (!dateStr) {
    return new Date().toISOString()
  }
  
  // If already ISO format, return as is
  if (dateStr.includes('T')) {
    return dateStr
  }
  
  // If YYYY-MM format, add day and time
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return `${dateStr}-15T12:00:00.000Z` // Middle of month
  }
  
  // If YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T12:00:00.000Z`
  }
  
  return new Date().toISOString()
}

/**
 * Convert Heart domain data to Observations
 */
function convertHeartData(
  heart: NonNullable<PrimeCheckJson['heart']>,
  completedAt: string
): Observation[] {
  const observations: Observation[] = []
  const now = completedAt || new Date().toISOString()

  // Cardio self-rating -> cardio_fitness driver
  if (heart.cardio_self_rating) {
    observations.push({
      driver_key: 'cardio_fitness',
      value: heart.cardio_self_rating,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  // Blood pressure -> bp driver
  if (heart.blood_pressure) {
    const bp = heart.blood_pressure
    // Store systolic as the primary value for scoring
    observations.push({
      driver_key: 'bp',
      value: bp.systolic,
      unit: 'mmHg',
      measured_at: toIsoTimestamp(bp.measured_date),
      source_type: 'measured_self_report',
      metadata: { 
        entry_method: 'onboarding_prime_check',
        diastolic: bp.diastolic,
      },
    })
  }

  // Resting heart rate -> rhr driver
  if (heart.resting_heart_rate) {
    const rhr = heart.resting_heart_rate
    let bpm: number
    
    if (rhr.bpm) {
      bpm = rhr.bpm
    } else if (rhr.range) {
      bpm = getRhrMidpoint(rhr.range)
    } else {
      bpm = 70 // Default
    }

    const sourceType: SourceType = rhr.source === 'wearable' 
      ? 'device' 
      : 'measured_self_report'

    observations.push({
      driver_key: 'rhr',
      value: bpm,
      unit: 'bpm',
      measured_at: toIsoTimestamp(rhr.measured_date),
      source_type: sourceType,
      metadata: { 
        entry_method: 'onboarding_prime_check',
        source_declared: rhr.source,
        range_used: rhr.range && !rhr.bpm,
      },
    })
  }

  return observations
}

/**
 * Calculate structural integrity score from SI questionnaire
 * 
 * Base score from SI1 (severity):
 * - No limitations → 90
 * - Mild → 75
 * - Moderate → 55
 * - Severe → 35
 * 
 * Adjustments:
 * - If SI3 is Ongoing (6+ weeks) or Comes-and-goes → −10
 * - If multiple locations selected → −5
 * - If SI4 "Often" → −5
 * 
 * Clamp 20–95
 */
function calculateStructuralIntegrityScore(si: StructuralIntegrityEntry): number {
  // Base score from severity
  const baseScores: Record<LimitationSeverity, number> = {
    'none': 90,
    'mild': 75,
    'moderate': 55,
    'severe': 35,
  }
  
  let score = baseScores[si.severity] ?? 70
  
  // Adjustment: chronic/recurring pattern
  if (si.duration === 'ongoing_6plus' || si.duration === 'intermittent') {
    score -= 10
  }
  
  // Adjustment: multiple affected areas
  if (si.areas && si.areas.length >= 2) {
    score -= 5
  }
  
  // Adjustment: frequent stiffness
  if (si.stiffness === 'often') {
    score -= 5
  }
  
  // Clamp to valid range
  return Math.max(20, Math.min(95, score))
}

/**
 * Extract coach flags from SI questionnaire
 */
function extractSICoachFlags(si: StructuralIntegrityEntry): {
  movement_restriction_flag: boolean
  chronic_issue_flag: boolean
  affected_areas: string[]
} {
  return {
    movement_restriction_flag: si.severity === 'moderate' || si.severity === 'severe',
    chronic_issue_flag: si.duration === 'ongoing_6plus' || si.duration === 'intermittent',
    affected_areas: si.areas || [],
  }
}

/**
 * Map old pain_limitation values to new structural_integrity values (backward compat)
 */
function mapPainToStructuralIntegrity(painValue: string): string {
  const mapping: Record<string, string> = {
    'none': 'no_limitations',
    'mild': 'mild_pain_only',
    'moderate': 'moderate_pain',
    'severe': 'severe',
  }
  return mapping[painValue] || painValue
}

/**
 * Convert Frame domain data to Observations
 */
function convertFrameData(
  frame: NonNullable<PrimeCheckJson['frame']>,
  identity: { height?: number; weight?: number } | undefined,
  completedAt: string
): Observation[] {
  const observations: Observation[] = []
  const now = completedAt || new Date().toISOString()

  // Push-up capability -> strength_proxy driver
  if (frame.pushup_capability) {
    observations.push({
      driver_key: 'strength_proxy',
      value: frame.pushup_capability,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  // Structural Integrity (new v1 questionnaire) -> structural_integrity driver
  if (frame.structural_integrity) {
    const siScore = calculateStructuralIntegrityScore(frame.structural_integrity)
    const coachFlags = extractSICoachFlags(frame.structural_integrity)
    
    observations.push({
      driver_key: 'structural_integrity',
      value: siScore, // Pre-computed score (0-100)
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { 
        entry_method: 'onboarding_prime_check_si_v1',
        severity: frame.structural_integrity.severity,
        areas: frame.structural_integrity.areas,
        duration: frame.structural_integrity.duration,
        stiffness: frame.structural_integrity.stiffness,
        // Coach flags for exercise filtering
        ...coachFlags,
      },
    })
  } 
  // Legacy: Pain limitation (backward compat)
  else if (frame.pain_limitation) {
    observations.push({
      driver_key: 'structural_integrity',
      value: mapPainToStructuralIntegrity(frame.pain_limitation),
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { 
        entry_method: 'onboarding_prime_check',
        original_value: frame.pain_limitation,
        legacy_format: true,
      },
    })
  }

  // Waist measurement -> waist_to_height driver
  if (frame.waist_cm && identity?.height) {
    const wth = calculateWaistToHeight(frame.waist_cm, identity.height)
    observations.push({
      driver_key: 'waist_to_height',
      value: wth,
      measured_at: now,
      source_type: 'measured_self_report',
      metadata: { 
        entry_method: 'onboarding_prime_check',
        waist_cm: frame.waist_cm,
        height_cm: identity.height,
      },
    })
  }

  // BMI from identity -> bmi driver
  if (identity?.height && identity?.weight) {
    const bmi = calculateBmi(identity.weight, identity.height)
    observations.push({
      driver_key: 'bmi',
      value: bmi,
      measured_at: now,
      source_type: 'measured_self_report',
      metadata: { 
        entry_method: 'onboarding_identity',
        height_cm: identity.height,
        weight_kg: identity.weight,
      },
    })
  }

  // Photo analysis results
  if (frame.photo_analysis) {
    const photoAnalysis = frame.photo_analysis
    const photoDate = photoAnalysis.analyzed_at || now
    const userHasMeasuredWaist = !!frame.waist_cm

    // Body fat -> body_fat driver
    if (photoAnalysis.body_fat_range) {
      const midpoint = (photoAnalysis.body_fat_range.low + photoAnalysis.body_fat_range.high) / 2
      observations.push({
        driver_key: 'body_fat',
        value: midpoint,
        unit: 'percent',
        measured_at: photoDate,
        source_type: 'image_estimate',
        metadata: {
          entry_method: 'body_photo_analysis',
          upload_id: photoAnalysis.upload_id,
          range_low: photoAnalysis.body_fat_range.low,
          range_high: photoAnalysis.body_fat_range.high,
        },
      })
    }

    // Lean mass -> lean_mass driver
    // Note: lean_mass_range_kg can have either {low, high} or {range_low, range_high} format
    if (photoAnalysis.lean_mass_range_kg) {
      const leanMass = photoAnalysis.lean_mass_range_kg as { low?: number; high?: number; range_low?: number; range_high?: number }
      const low = leanMass.low ?? leanMass.range_low
      const high = leanMass.high ?? leanMass.range_high
      // Only create observation if we have valid numbers
      if (typeof low === 'number' && typeof high === 'number' && !isNaN(low) && !isNaN(high)) {
        const midpoint = (low + high) / 2
        observations.push({
          driver_key: 'lean_mass',
          value: midpoint,
          unit: 'kg',
          measured_at: photoDate,
          source_type: 'image_estimate',
          metadata: {
            entry_method: 'body_photo_analysis',
            upload_id: photoAnalysis.upload_id,
            derived_from: 'body_fat_estimate + weight',
            range_low: low,
            range_high: high,
          },
        })
      }
    }

    // Midsection adiposity -> waist_to_height proxy (only if no measured waist)
    if (photoAnalysis.midsection_adiposity && !userHasMeasuredWaist) {
      const estimatedWHR = MIDSECTION_TO_WHR[photoAnalysis.midsection_adiposity]
      if (estimatedWHR) {
        observations.push({
          driver_key: 'waist_to_height',
          value: estimatedWHR,
          measured_at: photoDate,
          source_type: 'image_estimate',
          metadata: {
            entry_method: 'body_photo_analysis',
            upload_id: photoAnalysis.upload_id,
            derived_from: 'midsection_adiposity',
            original_value: photoAnalysis.midsection_adiposity,
          },
        })
      }
    }
  }

  return observations
}

/**
 * Convert Metabolism domain data to Observations
 */
function convertMetabolismData(
  metabolism: NonNullable<PrimeCheckJson['metabolism']>,
  completedAt: string
): Observation[] {
  const observations: Observation[] = []
  const now = completedAt || new Date().toISOString()

  // Labs (if present)
  if (metabolism.labs) {
    const labs = metabolism.labs
    const labDate = toIsoTimestamp(labs.test_date)

    if (labs.hba1c_percent) {
      observations.push({
        driver_key: 'hba1c',
        value: labs.hba1c_percent,
        unit: '%',
        measured_at: labDate,
        source_type: 'lab',
        metadata: { entry_method: 'onboarding_prime_check' },
      })
    }

    if (labs.apob_mg_dl) {
      observations.push({
        driver_key: 'apob',
        value: labs.apob_mg_dl,
        unit: 'mg/dL',
        measured_at: labDate,
        source_type: 'lab',
        metadata: { entry_method: 'onboarding_prime_check' },
      })
    }

    if (labs.hscrp_mg_l) {
      observations.push({
        driver_key: 'hscrp',
        value: labs.hscrp_mg_l,
        unit: 'mg/L',
        measured_at: labDate,
        source_type: 'lab',
        metadata: { entry_method: 'onboarding_prime_check' },
      })
    }

    // New lab markers
    if (labs.ldl_mg_dl) {
      observations.push({
        driver_key: 'ldl',
        value: labs.ldl_mg_dl,
        unit: 'mg/dL',
        measured_at: labDate,
        source_type: 'lab',
        metadata: { entry_method: 'onboarding_prime_check' },
      })
    }

    if (labs.triglycerides_mg_dl) {
      observations.push({
        driver_key: 'triglycerides',
        value: labs.triglycerides_mg_dl,
        unit: 'mg/dL',
        measured_at: labDate,
        source_type: 'lab',
        metadata: { entry_method: 'onboarding_prime_check' },
      })
    }

    if (labs.fasting_glucose_mg_dl) {
      observations.push({
        driver_key: 'fasting_glucose',
        value: labs.fasting_glucose_mg_dl,
        unit: 'mg/dL',
        measured_at: labDate,
        source_type: 'lab',
        metadata: { entry_method: 'onboarding_prime_check' },
      })
    }

    // Liver function: use ALT as primary (most sensitive for fatty liver)
    // If multiple liver markers present, we use ALT but store all in metadata
    if (labs.alt || labs.ast || labs.ggt) {
      const liverValue = labs.alt || labs.ast || labs.ggt
      observations.push({
        driver_key: 'liver_function',
        value: liverValue!,
        unit: 'U/L',
        measured_at: labDate,
        source_type: 'lab',
        metadata: { 
          entry_method: 'onboarding_prime_check',
          alt: labs.alt,
          ast: labs.ast,
          ggt: labs.ggt,
        },
      })
    }
  }

  // Metabolic risk from diagnoses + family history -> metabolic_risk driver
  if (metabolism.diagnoses || metabolism.family_history) {
    const riskCategory = deriveMetabolicRiskCategory(
      metabolism.diagnoses || [],
      metabolism.family_history || []
    )
    observations.push({
      driver_key: 'metabolic_risk',
      value: riskCategory,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { 
        entry_method: 'onboarding_prime_check',
        diagnoses: metabolism.diagnoses,
        family_history: metabolism.family_history,
        medications: metabolism.medications,
      },
    })
  }

  return observations
}

/**
 * Convert Recovery domain data to Observations
 */
function convertRecoveryData(
  recovery: NonNullable<PrimeCheckJson['recovery']>,
  completedAt: string
): Observation[] {
  const observations: Observation[] = []
  const now = completedAt || new Date().toISOString()

  // Sleep duration -> sleep_duration driver
  if (recovery.sleep_duration) {
    observations.push({
      driver_key: 'sleep_duration',
      value: recovery.sleep_duration,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  // Sleep regularity -> sleep_regularity driver
  if (recovery.sleep_regularity !== undefined) {
    observations.push({
      driver_key: 'sleep_regularity',
      value: String(recovery.sleep_regularity),
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  // Insomnia frequency -> insomnia driver
  if (recovery.insomnia_frequency) {
    observations.push({
      driver_key: 'insomnia',
      value: recovery.insomnia_frequency,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  return observations
}

/**
 * Convert Mind domain data to Observations
 */
function convertMindData(
  mind: NonNullable<PrimeCheckJson['mind']>,
  completedAt: string
): Observation[] {
  const observations: Observation[] = []
  const now = completedAt || new Date().toISOString()

  // Focus Check (PVT-lite) -> 3 objective drivers
  if (mind.focus_check) {
    const fc = mind.focus_check
    const testTime = fc.completed_at || now

    // Reaction time driver
    observations.push({
      driver_key: 'focus_check_rt',
      value: fc.median_rt_ms,
      unit: 'ms',
      measured_at: testTime,
      source_type: 'test',
      metadata: {
        entry_method: 'onboarding_focus_check',
        total_stimuli: fc.total_stimuli,
        duration_seconds: fc.duration_seconds,
        // Store all RTs for baseline comparison later
        reaction_times: fc.reaction_times_ms,
      },
    })

    // Lapses driver
    observations.push({
      driver_key: 'focus_check_lapses',
      value: fc.lapses,
      measured_at: testTime,
      source_type: 'test',
      metadata: {
        entry_method: 'onboarding_focus_check',
        total_stimuli: fc.total_stimuli,
        lapse_threshold_ms: 500,
      },
    })

    // Variability driver
    observations.push({
      driver_key: 'focus_check_variability',
      value: fc.variability_ms,
      unit: 'ms',
      measured_at: testTime,
      source_type: 'test',
      metadata: {
        entry_method: 'onboarding_focus_check',
        variability_metric: 'iqr',
      },
    })
  }

  // Focus stability -> focus_stability driver (fallback or additional context)
  if (mind.focus_stability) {
    observations.push({
      driver_key: 'focus_stability',
      value: mind.focus_stability,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  // Brain fog -> brain_fog driver
  if (mind.brain_fog) {
    observations.push({
      driver_key: 'brain_fog',
      value: mind.brain_fog,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  return observations
}

/**
 * Convert complete PrimeCheckJson to Observations array
 */
export function convertPrimeCheckToObservations(
  primeCheck: PrimeCheckJson,
  identity?: { height?: number; weight?: number; age?: number; sex?: string }
): Observation[] {
  const observations: Observation[] = []
  const completedAt = primeCheck.completed_at || new Date().toISOString()

  if (primeCheck.heart) {
    observations.push(...convertHeartData(primeCheck.heart, completedAt))
  }

  if (primeCheck.frame) {
    observations.push(...convertFrameData(primeCheck.frame, identity, completedAt))
  }

  if (primeCheck.metabolism) {
    observations.push(...convertMetabolismData(primeCheck.metabolism, completedAt))
  }

  if (primeCheck.recovery) {
    observations.push(...convertRecoveryData(primeCheck.recovery, completedAt))
  }

  if (primeCheck.mind) {
    observations.push(...convertMindData(primeCheck.mind, completedAt))
  }

  return observations
}

