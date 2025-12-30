'use client'

import { useState } from 'react'
import { FocusStability, BrainFogFrequency, FocusCheckResult } from '@/lib/onboarding/types'
import FocusCheck from '@/components/onboarding/FocusCheck'

interface MindCardProps {
  initialData?: {
    focus_check?: FocusCheckResult
    focus_stability?: FocusStability
    brain_fog?: BrainFogFrequency
  }
  onChange: (data: {
    focus_check?: FocusCheckResult
    focus_stability?: FocusStability
    brain_fog?: BrainFogFrequency
  }) => void
}

const FOCUS_OPTIONS: { value: FocusStability; label: string; short: string }[] = [
  { value: 'very_unstable', label: 'Very unstable', short: 'Hard to concentrate' },
  { value: 'somewhat_unstable', label: 'Somewhat unstable', short: 'Often distracted' },
  { value: 'mostly_stable', label: 'Mostly stable', short: 'Occasional lapses' },
  { value: 'very_stable', label: 'Very stable', short: 'Deep focus easily' },
]

const FOG_OPTIONS: { value: BrainFogFrequency; label: string }[] = [
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
]

export default function MindCard({ initialData, onChange }: MindCardProps) {
  const [focusCheck, setFocusCheck] = useState<FocusCheckResult | undefined>(
    initialData?.focus_check
  )
  const [focusStability, setFocusStability] = useState<FocusStability | undefined>(
    initialData?.focus_stability
  )
  const [brainFog, setBrainFog] = useState<BrainFogFrequency | undefined>(
    initialData?.brain_fog
  )
  const [showFallback, setShowFallback] = useState(false)

  const emitChange = (updates: Partial<{
    focus_check: FocusCheckResult
    focus_stability: FocusStability
    brain_fog: BrainFogFrequency
  }>) => {
    onChange({
      focus_check: updates.focus_check ?? focusCheck,
      focus_stability: updates.focus_stability ?? focusStability,
      brain_fog: updates.brain_fog ?? brainFog,
    })
  }

  const handleFocusCheckComplete = (result: FocusCheckResult) => {
    setFocusCheck(result)
    emitChange({ focus_check: result })
  }

  const handleSkipTest = () => {
    setShowFallback(true)
  }

  const handleFocusChange = (value: FocusStability) => {
    setFocusStability(value)
    emitChange({ focus_stability: value })
  }

  const handleFogChange = (value: BrainFogFrequency) => {
    setBrainFog(value)
    emitChange({ brain_fog: value })
  }

  const hasCompletedTest = !!focusCheck
  const showSelfReport = showFallback || hasCompletedTest

  return (
    <div className="bg-white">
      {/* Test completed badge */}
      {hasCompletedTest && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          <span className="text-[12px] px-2 py-1 bg-[#34C759]/10 text-[#34C759] rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Focus Check: {focusCheck!.median_rt_ms}ms median
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Section 1: Focus Check (Primary) */}
        {!hasCompletedTest && !showFallback && (
          <FocusCheck
            onComplete={handleFocusCheckComplete}
            onSkip={handleSkipTest}
          />
        )}

        {/* Show completed Focus Check summary */}
        {hasCompletedTest && (
          <div className="p-4 bg-[#34C759]/10 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[14px] font-medium text-[#248A3D]">Focus Check Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[16px] font-semibold text-[#248A3D]">{focusCheck.median_rt_ms}</div>
                <div className="text-[10px] text-[#248A3D]/70">Median RT</div>
              </div>
              <div>
                <div className="text-[16px] font-semibold text-[#248A3D]">{focusCheck.lapses}</div>
                <div className="text-[10px] text-[#248A3D]/70">Lapses</div>
              </div>
              <div>
                <div className="text-[16px] font-semibold text-[#248A3D]">{focusCheck.variability_ms}</div>
                <div className="text-[10px] text-[#248A3D]/70">Variability</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFocusCheck(undefined)}
              className="mt-2 text-[12px] text-[#248A3D] underline"
            >
              Retake test
            </button>
          </div>
        )}

        {/* Section 2: Self-Report (Fallback or Additional Context) */}
        {showSelfReport && (
          <>
            {/* Divider with context */}
            {hasCompletedTest && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E5E5EA]" />
                <span className="text-[11px] text-[#8E8E93] uppercase tracking-wide">Additional context</span>
                <div className="flex-1 h-px bg-[#E5E5EA]" />
              </div>
            )}
            
            {!hasCompletedTest && showFallback && (
              <div className="p-3 bg-[#FF9500]/10 rounded-xl">
                <p className="text-[12px] text-[#C85D00]">
                  ⚠️ Without the Focus Check, Mind confidence will be limited to Low.
                </p>
              </div>
            )}

            {/* Focus Stability */}
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                How stable is your focus?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FOCUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleFocusChange(opt.value)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      focusStability === opt.value
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    <span className="text-[14px] font-medium block">{opt.label}</span>
                    <span className={`text-[11px] ${
                      focusStability === opt.value ? 'text-white/70' : 'text-[#8E8E93]'
                    }`}>
                      {opt.short}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brain Fog */}
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Brain fog frequency
              </label>
              <div className="flex gap-2">
                {FOG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleFogChange(opt.value)}
                    className={`flex-1 p-3 rounded-xl text-[15px] font-medium transition-all ${
                      brainFog === opt.value
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
