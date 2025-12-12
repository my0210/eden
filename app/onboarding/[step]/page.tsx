import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/onboarding/getUserState'
import { getStep, getFirstMissingStep } from '@/lib/onboarding/steps'
import { redirect } from 'next/navigation'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import { completeOnboarding } from './actions'

interface OnboardingPageProps {
  params: Promise<{ step: string }>
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const user = await requireAuth()
  const { step: stepParam } = await params
  
  // Parse and validate step number
  const stepNumber = Math.max(1, Math.min(8, parseInt(stepParam, 10) || 1))
  
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

  // Navigation helpers
  const prevStep = stepNumber > 1 ? stepNumber - 1 : null
  const nextStep = stepNumber < 8 ? stepNumber + 1 : null

  return (
    <OnboardingShell
      step={stepNumber}
      title={stepInfo.title}
      subtitle={stepInfo.subtitle}
      showBack={prevStep !== null}
      showNext={true}
      backHref={prevStep ? `/onboarding/${prevStep}` : undefined}
      nextHref={nextStep ? `/onboarding/${nextStep}` : undefined}
      nextAction={!nextStep ? () => completeOnboarding(user.id) : undefined}
    >
      {/* Placeholder content - will be replaced with actual step components */}
      <div className="py-8">
        <p className="text-[17px] text-[#3C3C43] text-center">
          Step {stepNumber} content coming soon
        </p>
        {stepNumber === 8 && (
          <p className="text-[15px] text-[#8E8E93] text-center mt-4">
            All steps completed! Click &quot;Complete&quot; to finish onboarding.
          </p>
        )}
      </div>
    </OnboardingShell>
  )
}

