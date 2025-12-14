import { EdenUserState } from './getUserState'

/**
 * Onboarding Step Definitions (v2 - Bevel-inspired flow)
 * 
 * Step 1: Intro carousel (no inputs)
 * Step 2: Focus selection (optional, allow skip)
 * Step 3: Privacy/Trust (required checkbox)
 * Step 4: Uploads (Apple Health + photos, skippable)
 * Step 5: Safety rails (required, "none" allowed)
 * Step 6: Essentials (required: DOB/age, sex, height, weight, units)
 * Step 7: Transition "Building scorecard" (no inputs)
 * Step 8: Prime Scorecard reveal + CTA
 */

export interface OnboardingStep {
  number: number
  title: string
  subtitle: string
  required: boolean
}

export const ONBOARDING_STEPS: Record<number, OnboardingStep> = {
  1: {
    number: 1,
    title: 'Welcome to Eden',
    subtitle: 'Your personal health coach',
    required: false,
  },
  2: {
    number: 2,
    title: 'What matters most?',
    subtitle: 'Choose your primary focus (or skip)',
    required: false,
  },
  3: {
    number: 3,
    title: 'Privacy & Trust',
    subtitle: 'How we handle your data',
    required: true,
  },
  4: {
    number: 4,
    title: 'Connect Your Data',
    subtitle: 'Import health data for better insights',
    required: false,
  },
  5: {
    number: 5,
    title: 'Safety First',
    subtitle: 'Help us keep you safe',
    required: true,
  },
  6: {
    number: 6,
    title: 'The Essentials',
    subtitle: 'Basic info for personalized coaching',
    required: true,
  },
  7: {
    number: 7,
    title: 'Building Your Scorecard',
    subtitle: 'Analyzing your data',
    required: false,
  },
  8: {
    number: 8,
    title: 'Your Prime Scorecard',
    subtitle: 'Ready to start your journey',
    required: false,
  },
}

export const TOTAL_STEPS = 8

/**
 * Focus options for Step 2
 */
export const FOCUS_OPTIONS = [
  { key: 'longevity', label: 'Live Longer', description: 'Extend your healthspan and lifespan' },
  { key: 'performance', label: 'Perform Better', description: 'Optimize physical and mental performance' },
  { key: 'weight', label: 'Lose Weight', description: 'Sustainable body composition changes' },
  { key: 'energy', label: 'More Energy', description: 'Feel more vibrant and alert daily' },
  { key: 'recovery', label: 'Better Recovery', description: 'Improve sleep and stress resilience' },
  { key: 'prevention', label: 'Prevent Disease', description: 'Reduce chronic disease risk' },
] as const

/**
 * Validates the user state and returns the first missing step number.
 * Returns null if all required steps are complete.
 * 
 * Required fields by step (v2):
 * - Step 3: safety_json.privacy_ack === true
 * - Step 5: safety_json (diagnoses, meds, injuries_limitations, red_lines, doctor_restrictions)
 * - Step 6: identity_json (dob OR age, sex_at_birth, height, weight, units)
 * 
 * NOT required (removed from v1):
 * - time horizon
 * - weekly time budget
 * - coaching preferences (tone, cadence, nudge style, commitment, "why now")
 * - focus selection (optional)
 * - uploads (optional)
 */
export function getFirstMissingStep(state: EdenUserState): number | null {
  // Step 3: Privacy acknowledgment is REQUIRED
  if (!state.safety_json?.privacy_ack) {
    return 3
  }
  
  // Step 5: Safety rails are REQUIRED (each field can be "none" but must be present)
  const safety = state.safety_json
  if (!safety) {
    return 5
  }
  
  // Check each safety field exists (can be "none", empty array, or actual values)
  const hasDiagnoses = safety.diagnoses !== undefined
  const hasMeds = safety.meds !== undefined
  const hasInjuries = safety.injuries_limitations !== undefined
  const hasRedLines = safety.red_lines !== undefined
  const hasDoctorRestrictions = safety.doctor_restrictions !== undefined
  
  if (!hasDiagnoses || !hasMeds || !hasInjuries || !hasRedLines || !hasDoctorRestrictions) {
    return 5
  }
  
  // Step 6: Essentials are REQUIRED
  const identity = state.identity_json
  if (!identity) {
    return 6
  }
  
  // Must have either dob OR age
  const hasAge = identity.age !== undefined && identity.age !== null
  const hasDob = identity.dob !== undefined && identity.dob !== null && identity.dob !== ''
  if (!hasAge && !hasDob) {
    return 6
  }
  
  // Must have sex_at_birth
  if (!identity.sex_at_birth) {
    return 6
  }
  
  // Must have height and weight
  if (!identity.height || !identity.weight) {
    return 6
  }
  
  // Must have units preference
  if (!identity.units) {
    return 6
  }
  
  // All required steps are complete
  return null
}

/**
 * Check if user can proceed to a specific step
 * Steps 1-2 are always accessible
 * Step 3+ requires previous required steps to be complete
 */
export function canAccessStep(state: EdenUserState, stepNumber: number): boolean {
  if (stepNumber <= 2) {
    return true
  }
  
  // For step 3+, check if we're past it in the flow
  const currentStep = state.onboarding_step || 1
  
  // User can always go back to previous steps
  if (stepNumber <= currentStep) {
    return true
  }
  
  // For forward progress, check required steps
  const firstMissing = getFirstMissingStep(state)
  
  // If no required steps are missing, user can access any step
  if (firstMissing === null) {
    return true
  }
  
  // User can access steps up to and including the first missing required step
  return stepNumber <= firstMissing
}

/**
 * Get step information by number
 */
export function getStep(stepNumber: number): OnboardingStep | null {
  if (stepNumber < 1 || stepNumber > TOTAL_STEPS) {
    return null
  }
  return ONBOARDING_STEPS[stepNumber] || null
}

/**
 * Check if onboarding is complete (all required fields present)
 */
export function isOnboardingComplete(state: EdenUserState): boolean {
  return getFirstMissingStep(state) === null
}
