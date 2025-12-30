'use client'

import { useState } from 'react'
import { FocusStability, BrainFogFrequency } from '@/lib/onboarding/types'

interface MindCardProps {
  initialData?: {
    focus_stability?: FocusStability
    brain_fog?: BrainFogFrequency
  }
  onChange: (data: {
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
  const [focusStability, setFocusStability] = useState<FocusStability | undefined>(
    initialData?.focus_stability
  )
  const [brainFog, setBrainFog] = useState<BrainFogFrequency | undefined>(
    initialData?.brain_fog
  )

  const emitChange = (updates: Partial<{
    focus_stability: FocusStability
    brain_fog: BrainFogFrequency
  }>) => {
    onChange({
      focus_stability: updates.focus_stability ?? focusStability,
      brain_fog: updates.brain_fog ?? brainFog,
    })
  }

  const handleFocusChange = (value: FocusStability) => {
    setFocusStability(value)
    emitChange({ focus_stability: value })
  }

  const handleFogChange = (value: BrainFogFrequency) => {
    setBrainFog(value)
    emitChange({ brain_fog: value })
  }

  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#007AFF]/10 to-[#007AFF]/5 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#007AFF] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-black">Mind</h3>
            <p className="text-[13px] text-[#8E8E93]">Cognitive performance & focus</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Section 1: Focus Stability */}
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

        {/* Section 2: Brain Fog */}
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

        {/* Note about confidence */}
        <div className="p-3 bg-[#007AFF]/10 rounded-xl">
          <p className="text-[12px] text-[#0055CC]">
            💡 Mind scores are self-reported. A Focus Check feature is coming soon for more accurate cognitive assessment.
          </p>
        </div>
      </div>
    </div>
  )
}
