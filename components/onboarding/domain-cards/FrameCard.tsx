'use client'

import { useState } from 'react'
import { PushupCapability, PainLimitation } from '@/lib/onboarding/types'

interface FrameCardProps {
  initialData?: {
    pushup_capability?: PushupCapability
    pain_limitation?: PainLimitation
    waist_cm?: number
    waist_measured_correctly?: boolean
  }
  appleHealthData?: {
    weight?: number
    bodyMass?: number
  }
  onChange: (data: {
    pushup_capability?: PushupCapability
    pain_limitation?: PainLimitation
    waist_cm?: number
    waist_measured_correctly?: boolean
  }) => void
}

const PUSHUP_OPTIONS: { value: PushupCapability; label: string; description: string }[] = [
  { value: '0-5', label: '0-5 push-ups', description: 'Just starting out' },
  { value: '6-15', label: '6-15 push-ups', description: 'Building strength' },
  { value: '16-30', label: '16-30 push-ups', description: 'Good fitness' },
  { value: '31+', label: '31+ push-ups', description: 'Strong' },
  { value: 'not_possible', label: 'Not possible', description: 'Due to injury/condition' },
]

const PAIN_OPTIONS: { value: PainLimitation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

export default function FrameCard({ initialData, appleHealthData, onChange }: FrameCardProps) {
  const [pushupCapability, setPushupCapability] = useState<PushupCapability | undefined>(
    initialData?.pushup_capability
  )
  const [painLimitation, setPainLimitation] = useState<PainLimitation | undefined>(
    initialData?.pain_limitation
  )
  const [showWaistInput, setShowWaistInput] = useState(!!initialData?.waist_cm)
  const [waistCm, setWaistCm] = useState<number | ''>(initialData?.waist_cm || '')
  const [waistMeasuredCorrectly, setWaistMeasuredCorrectly] = useState(
    initialData?.waist_measured_correctly || false
  )

  const emitChange = (updates: Partial<{
    pushup_capability: PushupCapability
    pain_limitation: PainLimitation
    waist_cm: number
    waist_measured_correctly: boolean
  }>) => {
    const data: {
      pushup_capability?: PushupCapability
      pain_limitation?: PainLimitation
      waist_cm?: number
      waist_measured_correctly?: boolean
    } = {
      pushup_capability: updates.pushup_capability ?? pushupCapability,
      pain_limitation: updates.pain_limitation ?? painLimitation,
    }

    const waist = updates.waist_cm ?? waistCm
    if (waist) {
      data.waist_cm = Number(waist)
      data.waist_measured_correctly = updates.waist_measured_correctly ?? waistMeasuredCorrectly
    }

    onChange(data)
  }

  const handlePushupChange = (value: PushupCapability) => {
    setPushupCapability(value)
    emitChange({ pushup_capability: value })
  }

  const handlePainChange = (value: PainLimitation) => {
    setPainLimitation(value)
    emitChange({ pain_limitation: value })
  }

  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#5856D6]/10 to-[#5856D6]/5 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5856D6] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-black">Frame</h3>
            <p className="text-[13px] text-[#8E8E93]">Body composition & strength</p>
          </div>
        </div>

        {/* Apple Health Data Badge */}
        {appleHealthData && appleHealthData.weight && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[12px] px-2 py-1 bg-[#34C759]/10 text-[#34C759] rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Weight: {appleHealthData.weight.toFixed(1)} kg
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Quick Check: Push-up Capability */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Push-up capability
          </label>
          <div className="space-y-2">
            {PUSHUP_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePushupChange(opt.value)}
                className={`w-full p-3 rounded-xl text-left transition-all ${
                  pushupCapability === opt.value
                    ? 'bg-[#5856D6] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                <span className="text-[15px] font-medium">{opt.label}</span>
                <span className={`text-[13px] ml-2 ${
                  pushupCapability === opt.value ? 'text-white/80' : 'text-[#8E8E93]'
                }`}>
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Context: Pain/Limitation */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Pain or physical limitations
          </label>
          <div className="flex flex-wrap gap-2">
            {PAIN_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePainChange(opt.value)}
                className={`px-4 py-2 rounded-xl text-[15px] font-medium transition-all ${
                  painLimitation === opt.value
                    ? 'bg-[#5856D6] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add a measurement: Waist Circumference */}
        <div>
          <button
            type="button"
            onClick={() => setShowWaistInput(!showWaistInput)}
            className="flex items-center gap-2 text-[15px] text-[#007AFF] font-medium"
          >
            <span>{showWaistInput ? '−' : '+'}</span>
            Add waist measurement
          </button>

          {showWaistInput && (
            <div className="mt-3 p-4 bg-[#F2F2F7] rounded-xl space-y-3">
              <div>
                <label className="block text-[12px] text-[#8E8E93] mb-1">Waist circumference (cm)</label>
                <input
                  type="number"
                  value={waistCm}
                  onChange={e => {
                    const v = e.target.value ? Number(e.target.value) : ''
                    setWaistCm(v)
                  }}
                  onBlur={() => emitChange({})}
                  placeholder="85"
                  className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-[13px] text-[#3C3C43]">
                <input
                  type="checkbox"
                  checked={waistMeasuredCorrectly}
                  onChange={e => {
                    setWaistMeasuredCorrectly(e.target.checked)
                    emitChange({ waist_measured_correctly: e.target.checked })
                  }}
                  className="w-4 h-4 rounded border-[#C6C6C8] text-[#5856D6] focus:ring-[#5856D6]"
                />
                Measured at navel, relaxed
              </label>
              <p className="text-[12px] text-[#8E8E93]">
                💡 For accuracy, measure at your navel level while standing relaxed, not sucking in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

