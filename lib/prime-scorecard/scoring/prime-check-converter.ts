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
} from '@/lib/onboarding/types'
import { Observation, SourceType } from './types'
import { calculateWaistToHeight, calculateBmi, deriveMetabolicRiskCategory } from './driver-scorers'

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
 * Convert Frame domain data to Observations
 */
function convertFrameData(
  frame: NonNullable<PrimeCheckJson['frame']>,
  identity: { height?: number; weight?: number } | undefined,
  completedAt: string
): Observation[] {
  const observations: Observation[] = []
  const now = completedAt || new Date().toISOString()

  // Push-up capability -> pushups driver
  if (frame.pushup_capability) {
    observations.push({
      driver_key: 'pushups',
      value: frame.pushup_capability,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
    })
  }

  // Pain limitation -> pain_limitation driver
  if (frame.pain_limitation) {
    observations.push({
      driver_key: 'pain_limitation',
      value: frame.pain_limitation,
      measured_at: now,
      source_type: 'self_report_proxy',
      metadata: { entry_method: 'onboarding_prime_check' },
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
        measured_correctly: frame.waist_measured_correctly,
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

  // Focus stability -> focus_stability driver
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

