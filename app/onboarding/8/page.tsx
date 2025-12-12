import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/onboarding/getUserState'
import { getFirstMissingStep } from '@/lib/onboarding/steps'
import { redirect } from 'next/navigation'
import Step8Client from './Step8Client'

export default async function OnboardingStep8Page() {
  const user = await requireAuth()
  const supabase = await createClient()
  const state = await getUserState(supabase, user.id)

  // If already completed, go to chat
  if (state.onboarding_status === 'completed') {
    redirect('/chat')
  }

  // If not profile_complete, redirect to missing step
  if (state.onboarding_status !== 'profile_complete') {
    const firstMissing = getFirstMissingStep(state)
    if (firstMissing !== null) {
      redirect(`/onboarding/${firstMissing}`)
    }
    // If no missing steps but status isn't profile_complete, go to step 7
    redirect('/onboarding/7')
  }

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
                className="w-2 h-2 rounded-full bg-[#007AFF]"
              />
            ))}
          </div>
        </div>

        {/* Title and subtitle */}
        <h1 className="text-[28px] font-bold text-black mb-2">You&apos;re all set!</h1>
        <p className="text-[17px] text-[#8E8E93]">Your personalized health journey begins now</p>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        {/* Prime Snapshot placeholder */}
        <div className="p-6 bg-gradient-to-br from-[#007AFF]/10 to-[#5856D6]/10 rounded-xl border border-[#007AFF]/20 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-black">Prime Snapshot</h2>
              <p className="text-[13px] text-[#8E8E93]">Today</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[15px] text-[#8E8E93]">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Generating in Step 5 of the build</span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="space-y-3 mb-6">
          {state.goals_json && (
            <div className="p-4 bg-[#F2F2F7] rounded-xl">
              <p className="text-[13px] text-[#8E8E93] mb-1">Your focus</p>
              <p className="text-[15px] text-[#3C3C43] font-medium">
                {state.goals_json.goalCategory || 'Health'} • {state.goals_json.horizon || 6} month journey
              </p>
            </div>
          )}
          
          {state.coaching_json && (
            <div className="p-4 bg-[#F2F2F7] rounded-xl">
              <p className="text-[13px] text-[#8E8E93] mb-1">Coaching style</p>
              <p className="text-[15px] text-[#3C3C43] font-medium">
                {state.coaching_json.tone || 'Supportive'} • {state.coaching_json.cadence || 'Daily'} check-ins
              </p>
            </div>
          )}
        </div>

        <Step8Client userId={user.id} />
      </div>
    </div>
  )
}

