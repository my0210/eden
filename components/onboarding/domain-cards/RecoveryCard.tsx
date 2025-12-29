'use client'

import { useState } from 'react'
import { SleepDuration, InsomniaFrequency } from '@/lib/onboarding/types'

interface RecoveryCardProps {
  initialData?: {
    sleep_duration?: SleepDuration
    sleep_regularity?: boolean
    insomnia_frequency?: InsomniaFrequency
  }
  appleHealthData?: {
    avgSleepDuration?: number // in hours
    sleepQuality?: string
  }
  onChange: (data: {
    sleep_duration?: SleepDuration
    sleep_regularity?: boolean
    insomnia_frequency?: InsomniaFrequency
  }) => void
}

const SLEEP_DURATION_OPTIONS: { value: SleepDuration; label: string }[] = [
  { value: '<6h', label: 'Less than 6 hours' },
  { value: '6-7h', label: '6-7 hours' },
  { value: '7-8h', label: '7-8 hours' },
  { value: '8h+', label: '8+ hours' },
]

const INSOMNIA_OPTIONS: { value: InsomniaFrequency; label: string }[] = [
  { value: '<1', label: 'Less than 1 night/week' },
  { value: '1-2', label: '1-2 nights/week' },
  { value: '3-4', label: '3-4 nights/week' },
  { value: '5+', label: '5+ nights/week' },
]

export default function RecoveryCard({ initialData, appleHealthData, onChange }: RecoveryCardProps) {
  const [sleepDuration, setSleepDuration] = useState<SleepDuration | undefined>(
    initialData?.sleep_duration
  )
  const [sleepRegularity, setSleepRegularity] = useState<boolean | undefined>(
    initialData?.sleep_regularity
  )
  const [insomniaFrequency, setInsomniaFrequency] = useState<InsomniaFrequency | undefined>(
    initialData?.insomnia_frequency
  )

  const emitChange = (updates: Partial<{
    sleep_duration: SleepDuration
    sleep_regularity: boolean
    insomnia_frequency: InsomniaFrequency
  }>) => {
    onChange({
      sleep_duration: updates.sleep_duration ?? sleepDuration,
      sleep_regularity: updates.sleep_regularity ?? sleepRegularity,
      insomnia_frequency: updates.insomnia_frequency ?? insomniaFrequency,
    })
  }

  const handleDurationChange = (value: SleepDuration) => {
    setSleepDuration(value)
    emitChange({ sleep_duration: value })
  }

  const handleRegularityChange = (value: boolean) => {
    setSleepRegularity(value)
    emitChange({ sleep_regularity: value })
  }

  const handleInsomniaChange = (value: InsomniaFrequency) => {
    setInsomniaFrequency(value)
    emitChange({ insomnia_frequency: value })
  }

  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#34C759]/10 to-[#34C759]/5 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#34C759] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-black">Recovery</h3>
            <p className="text-[13px] text-[#8E8E93]">Sleep & stress resilience</p>
          </div>
        </div>

        {/* Apple Health Data Badge */}
        {appleHealthData && appleHealthData.avgSleepDuration && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[12px] px-2 py-1 bg-[#34C759]/10 text-[#34C759] rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Avg sleep: {appleHealthData.avgSleepDuration.toFixed(1)}h
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Quick Check: Sleep Duration */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Average sleep duration (weekday)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SLEEP_DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleDurationChange(opt.value)}
                className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                  sleepDuration === opt.value
                    ? 'bg-[#34C759] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Check: Sleep Regularity */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Do you go to bed and wake up at roughly the same time each day?
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleRegularityChange(true)}
              className={`flex-1 p-3 rounded-xl text-[15px] font-medium transition-all ${
                sleepRegularity === true
                  ? 'bg-[#34C759] text-white'
                  : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handleRegularityChange(false)}
              className={`flex-1 p-3 rounded-xl text-[15px] font-medium transition-all ${
                sleepRegularity === false
                  ? 'bg-[#34C759] text-white'
                  : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Quick Check: Insomnia Frequency */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            How often do you have trouble falling or staying asleep?
          </label>
          <div className="space-y-2">
            {INSOMNIA_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleInsomniaChange(opt.value)}
                className={`w-full p-3 rounded-xl text-left text-[15px] font-medium transition-all ${
                  insomniaFrequency === opt.value
                    ? 'bg-[#34C759] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connect tip */}
        <div className="p-3 bg-[#34C759]/10 rounded-xl">
          <p className="text-[13px] text-[#248A3D]">
            💡 Connect Apple Health for automatic sleep tracking and more accurate Recovery scores.
          </p>
        </div>
      </div>
    </div>
  )
}

