import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/onboarding/getUserState'
import { getStep, getFirstMissingStep, TOTAL_STEPS } from '@/lib/onboarding/steps'
import { redirect } from 'next/navigation'
import OnboardingStepClient from '@/components/onboarding/OnboardingStepClient'
import Step8ScorecardReveal from '@/components/onboarding/Step8ScorecardReveal'

interface OnboardingPageProps {
  params: Promise<{ step: string }>
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const user = await requireAuth()
  const { step: stepParam } = await params
  
  // Parse and validate step number
  const stepNumber = Math.max(1, Math.min(TOTAL_STEPS, parseInt(stepParam, 10) || 1))
  
  // Load user state
  const supabase = await createClient()
  const state = await getUserState(supabase, user.id)

  // If onboarding is already completed, redirect to chat
  if (state.onboarding_status === 'completed') {
    redirect('/chat')
  }

  // If user is on step 8, validate that all required steps are complete
  if (stepNumber === 8) {
    const firstMissing = getFirstMissingStep(state)
    if (firstMissing !== null) {
      redirect(`/onboarding/${firstMissing}`)
    }
  }

  // Get step information
  const stepInfo = getStep(stepNumber)
  if (!stepInfo) {
    redirect('/onboarding/1')
  }

  // Steps 1-7 use the client component with forms
  if (stepNumber < 8) {
    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Step indicator */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[13px] text-[#8E8E93] uppercase tracking-wide">
              Step {stepNumber} of {TOTAL_STEPS}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full ${
                    s <= stepNumber ? 'bg-[#007AFF]' : 'bg-[#E5E5EA]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Title and subtitle */}
          <h1 className="text-[28px] font-bold text-black mb-2">{stepInfo.title}</h1>
          <p className="text-[17px] text-[#8E8E93]">{stepInfo.subtitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <OnboardingStepClient key={`step-${stepNumber}-${state.updated_at}`} step={stepNumber} state={state} />
        </div>
      </div>
    )
  }

  // Step 8: Prime Scorecard Reveal + CTA (client component)
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[13px] text-[#8E8E93] uppercase tracking-wide">
            Step {TOTAL_STEPS} of {TOTAL_STEPS}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className="w-2 h-2 rounded-full bg-[#007AFF]"
              />
            ))}
          </div>
        </div>

        {/* Title and subtitle */}
        <h1 className="text-[28px] font-bold text-black mb-2">{stepInfo.title}</h1>
        <p className="text-[17px] text-[#8E8E93]">{stepInfo.subtitle}</p>
      </div>

      {/* Prime Scorecard Reveal (client component) */}
      <div className="px-6 pb-6">
        <Step8ScorecardReveal 
          userId={user.id}
          focusPrimary={state.goals_json?.focus_primary}
          focusSecondary={state.goals_json?.focus_secondary}
        />
      </div>
    </div>
  )
}
