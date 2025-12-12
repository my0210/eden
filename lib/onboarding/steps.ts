import { EdenUserState } from './getUserState'

export interface OnboardingStep {
  number: number
  title: string
  subtitle: string
}

export const ONBOARDING_STEPS: Record<number, OnboardingStep> = {
  1: {
    number: 1,
    title: 'Welcome to Eden',
    subtitle: 'Let\'s get you started on your health journey',
  },
  2: {
    number: 2,
    title: 'Tell us about yourself',
    subtitle: 'Help us understand who you are',
  },
  3: {
    number: 3,
    title: 'Connect your data',
    subtitle: 'Import your health data to get personalized insights',
  },
  4: {
    number: 4,
    title: 'What are your goals?',
    subtitle: 'What do you want to achieve?',
  },
  5: {
    number: 5,
    title: 'Safety & Health',
    subtitle: 'Help us keep you safe',
  },
  6: {
    number: 6,
    title: 'Your behaviors',
    subtitle: 'Tell us about your current habits',
  },
  7: {
    number: 7,
    title: 'Coaching preferences',
    subtitle: 'How would you like to be coached?',
  },
  8: {
    number: 8,
    title: 'Review & complete',
    subtitle: 'Review your information and complete onboarding',
  },
}

/**
 * Validates the user state and returns the first missing step number.
 * Returns null if all required steps are complete.
 * 
 * Required fields by step:
 * - Step 2: goals_json (goalCategory, horizon, priorityDomains)
 * - Step 4: identity_json (age, sexAtBirth, heightCm, weightKg, timezone, location, workStyle, freeTimeWindows)
 * - Step 5: safety_json (diagnoses, meds, injuriesYesNo, redLines, doctorRestrictionsYesNo)
 * - Step 6: behaviors_json (domainSelections, timeBudget)
 * - Step 7: coaching_json (tone, cadence, nudgeStyle, commitment, whyNow)
 */
export function getFirstMissingStep(state: EdenUserState): number | null {
  // Step 2: Goals
  if (!state.goals_json || !state.goals_json.goalCategory || !state.goals_json.horizon) {
    return 2
  }
  
  // Step 4: Identity
  if (!state.identity_json || !state.identity_json.age || !state.identity_json.sexAtBirth) {
    return 4
  }
  
  // Step 5: Safety
  if (!state.safety_json || state.safety_json.injuriesYesNo === undefined) {
    return 5
  }
  
  // Step 6: Behaviors
  if (!state.behaviors_json || !state.behaviors_json.timeBudget) {
    return 6
  }
  
  // Step 7: Coaching preferences
  if (!state.coaching_json || !state.coaching_json.tone || !state.coaching_json.whyNow) {
    return 7
  }
  
  // All required steps are complete
  return null
}

/**
 * Get step information by number
 */
export function getStep(stepNumber: number): OnboardingStep | null {
  if (stepNumber < 1 || stepNumber > 8) {
    return null
  }
  return ONBOARDING_STEPS[stepNumber] || null
}

