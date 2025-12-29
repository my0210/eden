'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EdenUserState } from '@/lib/onboarding/getUserState'
import AppleHealthUpload from '@/components/uploads/AppleHealthUpload'
import Step5PrimeCheck from './Step5PrimeCheck'

interface OnboardingStepClientProps {
  step: number
  state: EdenUserState
}

// Intro carousel slides
const INTRO_SLIDES = [
  {
    title: 'Welcome to Eden',
    description: 'Your personal AI health coach, focused on extending your primespan — the years you feel strong, clear, and capable.',
    icon: '🌿',
  },
  {
    title: 'Five Dimensions of Health',
    description: 'We track Heart, Frame, Metabolism, Recovery, and Mind to give you a complete picture of your wellbeing.',
    icon: '⭐',
  },
  {
    title: 'Data-Driven Insights',
    description: "Import your Apple Health data and we'll build a personalized Prime Scorecard showing where you stand.",
    icon: '📊',
  },
  {
    title: 'Coaching That Adapts',
    description: 'Eden learns your goals, constraints, and preferences to give actionable advice that fits your life.',
    icon: '🎯',
  },
]

export default function OnboardingStepClient({ step, state }: OnboardingStepClientProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Intro carousel
  const [currentSlide, setCurrentSlide] = useState(0)

  // Step 2: Privacy acknowledgment
  const [privacyAck, setPrivacyAck] = useState(state.safety_json?.privacy_ack || false)

  // Step 3: Identity Essentials
  const [age, setAge] = useState<number | ''>(state.identity_json?.age || '')
  const [sexAtBirth, setSexAtBirth] = useState<string>(state.identity_json?.sex_at_birth || '')
  const [height, setHeight] = useState<number | ''>(state.identity_json?.height || '')
  const [weight, setWeight] = useState<number | ''>(state.identity_json?.weight || '')
  const [units, setUnits] = useState<'metric' | 'imperial'>(state.identity_json?.units || 'metric')

  // Step 4: Uploads (tracked via uploads component, we just track skip state)
  const [uploadsSkipped, setUploadsSkipped] = useState(state.goals_json?.uploads_skipped || false)

  const validateStep = (): string | null => {
    switch (step) {
      case 2:
        if (!privacyAck) return 'Please acknowledge the privacy policy to continue'
        break
      case 3:
        if (!age || age < 1 || age > 120) return 'Please enter a valid age'
        if (!sexAtBirth) return 'Please select sex at birth'
        if (!height || height <= 0) return 'Please enter your height'
        if (!weight || weight <= 0) return 'Please enter your weight'
        if (!units) return 'Please select your preferred units'
        break
    }
    return null
  }

  const buildPatch = () => {
    switch (step) {
      case 1:
        return {}
      case 2:
        return {
          safety_json: {
            privacy_ack: privacyAck,
          }
        }
      case 3:
        // Convert to metric for storage
        let heightCm = Number(height)
        let weightKg = Number(weight)
        if (units === 'imperial') {
          heightCm = Number(height) * 2.54 // inches to cm
          weightKg = Number(weight) * 0.453592 // lbs to kg
        }
        return {
          identity_json: {
            age: Number(age),
            sex_at_birth: sexAtBirth,
            height: Math.round(heightCm * 10) / 10,
            weight: Math.round(weightKg * 10) / 10,
            units: units,
          }
        }
      case 4:
        return {
          goals_json: {
            uploads_skipped: uploadsSkipped,
          }
        }
      default:
        return {}
    }
  }

  const handleNext = async () => {
    // Steps that need validation
    if ([2, 3].includes(step)) {
      const validationError = validateStep()
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setError(null)
    setSaving(true)

    try {
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          onboarding_status: 'in_progress',
          patch: buildPatch(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      router.push(`/onboarding/${step + 1}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    router.push(`/onboarding/${step - 1}`)
  }

  const handleSkip = async () => {
    setSaving(true)
    try {
      const patch: Record<string, unknown> = {}
      
      if (step === 4) {
        patch.goals_json = { uploads_skipped: true }
        setUploadsSkipped(true)
      }

      await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          onboarding_status: 'in_progress',
          patch,
        }),
      })
      router.push(`/onboarding/${step + 1}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Intro Carousel */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#007AFF]/10 to-[#34C759]/10 p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">{INTRO_SLIDES[currentSlide].icon}</div>
              <h2 className="text-[22px] font-bold text-black mb-3">
                {INTRO_SLIDES[currentSlide].title}
              </h2>
              <p className="text-[17px] text-[#3C3C43] leading-relaxed">
                {INTRO_SLIDES[currentSlide].description}
              </p>
            </div>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2">
            {INTRO_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  idx === currentSlide ? 'bg-[#007AFF]' : 'bg-[#E5E5EA]'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA]">
            {currentSlide > 0 ? (
              <button
                onClick={() => setCurrentSlide(currentSlide - 1)}
                className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {currentSlide < INTRO_SLIDES.length - 1 ? (
              <button
                onClick={() => setCurrentSlide(currentSlide + 1)}
                className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={saving}
                className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
              >
                {saving ? 'Saving…' : 'Get Started'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Privacy & Trust */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-[#F2F2F7] rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-black">Your Data is Private</h3>
                <p className="text-[15px] text-[#3C3C43] mt-1">
                  Your health data is encrypted and never shared without your explicit consent. 
                  We use it only to provide personalized coaching.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#34C759] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-black">Confidence Labels</h3>
                <p className="text-[15px] text-[#3C3C43] mt-1">
                  Each insight shows a confidence level based on how much data we have. 
                  More data = more accurate recommendations.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF9500] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-black">Not Medical Advice</h3>
                <p className="text-[15px] text-[#3C3C43] mt-1">
                  Eden is a coaching tool, not a medical service. Always consult healthcare 
                  professionals for medical decisions.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 bg-white border-2 border-[#E5E5EA] rounded-xl cursor-pointer hover:border-[#007AFF] transition-colors">
            <input
              type="checkbox"
              checked={privacyAck}
              onChange={(e) => setPrivacyAck(e.target.checked)}
              className="w-6 h-6 rounded-md border-2 border-[#C6C6C8] text-[#007AFF] focus:ring-[#007AFF] mt-0.5"
            />
            <span className="text-[17px] text-[#3C3C43]">
              I understand how Eden handles my data and that insights include confidence labels
            </span>
          </label>

          {error && (
            <div className="p-4 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA]">
            <button
              onClick={handleBack}
              className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
            >
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={saving || !privacyAck}
              className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
            >
              {saving ? 'Saving…' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Identity Essentials */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Age
            </label>
            <input
              type="number"
              value={age}
              onChange={e => setAge(e.target.value ? Number(e.target.value) : '')}
              placeholder="30"
              min="1"
              max="120"
              className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Sex at Birth
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSexAtBirth(opt.value)}
                  className={`p-3 rounded-xl text-[17px] font-medium transition-all ${
                    sexAtBirth === opt.value
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Measurement Units
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'metric', label: 'Metric (cm, kg)' },
                { value: 'imperial', label: 'Imperial (ft, lbs)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUnits(opt.value as 'metric' | 'imperial')}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    units === opt.value
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Height ({units === 'metric' ? 'cm' : 'inches'})
              </label>
              <input
                type="number"
                value={height}
                onChange={e => setHeight(e.target.value ? Number(e.target.value) : '')}
                placeholder={units === 'metric' ? '175' : '70'}
                className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Weight ({units === 'metric' ? 'kg' : 'lbs'})
              </label>
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value ? Number(e.target.value) : '')}
                placeholder={units === 'metric' ? '70' : '154'}
                className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA]">
            <button
              onClick={handleBack}
              className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
            >
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={saving}
              className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
            >
              {saving ? 'Saving…' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Apple Health Upload */}
      {step === 4 && (
        <div className="space-y-6">
          <p className="text-[15px] text-[#8E8E93]">
            Import your health data for a more accurate Prime Scorecard. You can always add more later.
          </p>

          <div className="space-y-4">
            <div className="bg-white border border-[#E5E5EA] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FF2D55]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#FF2D55]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-black">Apple Health</h3>
                  <p className="text-[13px] text-[#8E8E93]">Export from iPhone: Health → Profile → Export All</p>
                </div>
              </div>
              <AppleHealthUpload source="onboarding" />
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#FFF8E5] border border-[#FFD60A]/60 text-[#8E8E93] text-[14px] rounded-xl px-4 py-3">
            <span>Not ready to upload?</span>
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="text-[#FF9500] font-semibold hover:opacity-70 transition-opacity"
            >
              Skip for now
            </button>
          </div>

          {uploadsSkipped && (
            <div className="p-4 rounded-xl bg-[#FF9500]/10 text-[#C85D00] text-[15px]">
              ⚠️ Your Prime Scorecard will have lower confidence until you upload data.
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA]">
            <button
              onClick={handleBack}
              className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
            >
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={saving}
              className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
            >
              {saving ? 'Saving…' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Prime Check */}
      {step === 5 && (
        <Step5PrimeCheck state={state} />
      )}
    </div>
  )
}
