import { EdenUserState } from './getUserState'
import { PrimeCheckJson } from './types'

/**
 * Onboarding Step Definitions (v3 - Prime Check flow)
 * 
 * New 6-step flow:
 * Step 1: Intro carousel (no inputs)
 * Step 2: Privacy/Trust (required checkbox)
 * Step 3: Identity Essentials (required: age, sex, height, weight)
 * Step 4: Apple Health Upload (optional)
 * Step 5: Prime Check (5 domain cards with quick checks)
 * Step 6: Scorecard Reveal (full scorecard with confidence)
 * 
 * Removed from v2:
 * - Focus selection (moved to coach chat)
 * - Safety rails (collected by coach when creating a plan)
 * - Building scorecard transition (loading shown in Step 6)
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
    title: 'Privacy & Trust',
    subtitle: 'How we handle your data',
    required: true,
  },
  3: {
    number: 3,
    title: 'The Essentials',
    subtitle: 'Basic info for personalized coaching',
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
    title: 'Prime Check',
    subtitle: 'Quick health assessment',
    required: true,
  },
  6: {
    number: 6,
    title: 'Your Prime Scorecard',
    subtitle: 'Ready to start your journey',
    required: false,
  },
}

export const TOTAL_STEPS = 6

/**
 * Validates the user state and returns the first missing step number.
 * Returns null if all required steps are complete.
 * 
 * Required fields by step (v3):
 * - Step 2: safety_json.privacy_ack === true
 * - Step 3: identity_json (age, sex_at_birth, height, weight, units)
 * - Step 5: prime_check_json (at least schema_version present)
 */
export function getFirstMissingStep(state: EdenUserState): number | null {
  // Step 2: Privacy acknowledgment is REQUIRED
  if (!state.safety_json?.privacy_ack) {
    return 2
  }
  
  // Step 3: Identity Essentials are REQUIRED
  const identity = state.identity_json
  if (!identity) {
    return 3
  }
  
  // Must have age (age field directly, not DOB anymore for simplicity)
  const hasAge = identity.age !== undefined && identity.age !== null
  if (!hasAge) {
    return 3
  }
  
  // Must have sex_at_birth
  if (!identity.sex_at_birth) {
    return 3
  }
  
  // Must have height and weight
  if (!identity.height || !identity.weight) {
    return 3
  }
  
  // Must have units preference
  if (!identity.units) {
    return 3
  }
  
  // Step 4 (Apple Health) is optional - skip validation
  
  // Step 5: Prime Check is REQUIRED
  const primeCheck = state.prime_check_json as PrimeCheckJson | null | undefined
  if (!primeCheck || !primeCheck.schema_version) {
    return 5
  }
  
  // Check that at least one domain has data
  const hasAnyData = 
    primeCheck.heart?.cardio_self_rating ||
    primeCheck.frame?.pushup_capability ||
    primeCheck.metabolism?.diagnoses?.length ||
    primeCheck.recovery?.sleep_duration ||
    primeCheck.mind?.focus_stability
  
  if (!hasAnyData) {
    return 5
  }
  
  // All required steps are complete
  return null
}

/**
 * Check if user can proceed to a specific step
 * Step 1 is always accessible
 * Step 2+ requires previous required steps to be complete
 */
export function canAccessStep(state: EdenUserState, stepNumber: number): boolean {
  if (stepNumber <= 1) {
    return true
  }
  
  // For step 2+, check if we're past it in the flow
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

/**
 * Get the next step number (for navigation)
 */
export function getNextStep(currentStep: number): number | null {
  if (currentStep >= TOTAL_STEPS) {
    return null
  }
  return currentStep + 1
}

/**
 * Get the previous step number (for navigation)
 */
export function getPreviousStep(currentStep: number): number | null {
  if (currentStep <= 1) {
    return null
  }
  return currentStep - 1
}
