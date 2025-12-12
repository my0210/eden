import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/onboarding/getUserState'
import { getStep, getFirstMissingStep } from '@/lib/onboarding/steps'
import { redirect } from 'next/navigation'
import OnboardingStepClient from '@/components/onboarding/OnboardingStepClient'
import { completeOnboarding } from './actions'
import Link from 'next/link'

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

  // Steps 1-7 use the client component with forms
  if (stepNumber < 8) {
    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Step indicator */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[13px] text-[#8E8E93] uppercase tracking-wide">
              Step {stepNumber} of 8
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
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
          <OnboardingStepClient step={stepNumber} state={state} />
        </div>
      </div>
    )
  }

  // Step 8: Review and complete
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[13px] text-[#8E8E93] uppercase tracking-wide">
            Step 8 of 8
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${
                  s <= 8 ? 'bg-[#007AFF]' : 'bg-[#E5E5EA]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Title and subtitle */}
        <h1 className="text-[28px] font-bold text-black mb-2">{stepInfo.title}</h1>
        <p className="text-[17px] text-[#8E8E93]">{stepInfo.subtitle}</p>
      </div>

      {/* Review content */}
      <div className="px-6 pb-6">
        <div className="space-y-4">
          {/* Goals summary */}
          {state.goals_json && Object.keys(state.goals_json).length > 0 && (
            <div className="p-4 bg-[#F2F2F7] rounded-xl">
              <h3 className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">Goals</h3>
              <p className="text-[15px] text-[#3C3C43]">
                {state.goals_json.goalCategory} • {state.goals_json.horizon} months
              </p>
              {state.goals_json.priorityDomains && (
                <p className="text-[13px] text-[#8E8E93] mt-1">
                  Focus: {state.goals_json.priorityDomains.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Identity summary */}
          {state.identity_json && Object.keys(state.identity_json).length > 0 && (
            <div className="p-4 bg-[#F2F2F7] rounded-xl">
              <h3 className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">About You</h3>
              <p className="text-[15px] text-[#3C3C43]">
                {state.identity_json.age && `${state.identity_json.age} years old`}
                {state.identity_json.location && ` • ${state.identity_json.location}`}
              </p>
            </div>
          )}

          {/* Coaching summary */}
          {state.coaching_json && Object.keys(state.coaching_json).length > 0 && (
            <div className="p-4 bg-[#F2F2F7] rounded-xl">
              <h3 className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">Coaching Style</h3>
              <p className="text-[15px] text-[#3C3C43]">
                {state.coaching_json.tone} tone • {state.coaching_json.cadence} check-ins
              </p>
              <p className="text-[13px] text-[#8E8E93] mt-1">
                Commitment: {state.coaching_json.commitment}/10
              </p>
            </div>
          )}

          <div className="text-center py-4">
            <p className="text-[15px] text-[#34C759]">
              ✓ All set! Click below to start your journey with Eden.
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5EA] mt-6">
          <Link
            href="/onboarding/7"
            className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
          >
            Back
          </Link>

          <form action={() => completeOnboarding(user.id)}>
            <button
              type="submit"
              className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] transition-colors"
            >
              Complete Setup
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
