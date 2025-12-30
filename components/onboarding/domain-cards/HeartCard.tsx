'use client'

import { useState } from 'react'
import {
  CardioSelfRating,
  BloodPressureEntry,
  RestingHeartRateEntry,
  RhrRange,
} from '@/lib/onboarding/types'

interface HeartCardProps {
  initialData?: {
    cardio_self_rating?: CardioSelfRating
    blood_pressure?: BloodPressureEntry
    resting_heart_rate?: RestingHeartRateEntry
  }
  appleHealthData?: {
    rhr?: number
    hrv?: number
  }
  onChange: (data: {
    cardio_self_rating?: CardioSelfRating
    blood_pressure?: BloodPressureEntry
    resting_heart_rate?: RestingHeartRateEntry
  }) => void
}

const CARDIO_OPTIONS: { value: CardioSelfRating; label: string }[] = [
  { value: 'below_avg', label: 'Below average' },
  { value: 'slightly_below', label: 'Slightly below' },
  { value: 'average', label: 'Average' },
  { value: 'slightly_above', label: 'Slightly above' },
  { value: 'above_avg', label: 'Above average' },
  { value: 'not_sure', label: 'Not sure' },
]

const RHR_RANGES: { value: RhrRange; label: string; desc: string }[] = [
  { value: '<55', label: '< 55', desc: 'Athletic' },
  { value: '55-64', label: '55-64', desc: 'Fit' },
  { value: '65-74', label: '65-74', desc: 'Average' },
  { value: '75-84', label: '75-84', desc: 'Below avg' },
  { value: '85+', label: '85+', desc: 'High' },
]

type BpRecency = 'recent' | 'months_ago' | 'year_plus'

const BP_RECENCY_OPTIONS: { value: BpRecency; label: string }[] = [
  { value: 'recent', label: 'Last month' },
  { value: 'months_ago', label: '1-6 months' },
  { value: 'year_plus', label: '6+ months' },
]

export default function HeartCard({ initialData, appleHealthData, onChange }: HeartCardProps) {
  const [cardioRating, setCardioRating] = useState<CardioSelfRating | undefined>(
    initialData?.cardio_self_rating
  )
  const [systolic, setSystolic] = useState<number | ''>(initialData?.blood_pressure?.systolic || '')
  const [diastolic, setDiastolic] = useState<number | ''>(initialData?.blood_pressure?.diastolic || '')
  const [bpRecency, setBpRecency] = useState<BpRecency | undefined>(
    initialData?.blood_pressure?.measured_date ? 'recent' : undefined
  )
  
  const [rhrRange, setRhrRange] = useState<RhrRange | undefined>(
    initialData?.resting_heart_rate?.range || 
    (initialData?.resting_heart_rate?.bpm ? getRangeFromBpm(initialData.resting_heart_rate.bpm) : undefined)
  )

  function getRangeFromBpm(bpm: number): RhrRange {
    if (bpm < 55) return '<55'
    if (bpm < 65) return '55-64'
    if (bpm < 75) return '65-74'
    if (bpm < 85) return '75-84'
    return '85+'
  }

  function getDateFromRecency(recency: BpRecency): string {
    const now = new Date()
    switch (recency) {
      case 'recent':
        return now.toISOString().slice(0, 7) // This month
      case 'months_ago':
        now.setMonth(now.getMonth() - 3)
        return now.toISOString().slice(0, 7)
      case 'year_plus':
        now.setMonth(now.getMonth() - 9)
        return now.toISOString().slice(0, 7)
    }
  }

  const emitChange = (updates: Partial<{
    cardio_self_rating: CardioSelfRating
    blood_pressure: BloodPressureEntry
    resting_heart_rate: RestingHeartRateEntry
  }>) => {
    const data: {
      cardio_self_rating?: CardioSelfRating
      blood_pressure?: BloodPressureEntry
      resting_heart_rate?: RestingHeartRateEntry
    } = {
      cardio_self_rating: updates.cardio_self_rating ?? cardioRating,
    }

    // Include BP if systolic and diastolic are present (recency optional)
    const sys = updates.blood_pressure?.systolic ?? systolic
    const dia = updates.blood_pressure?.diastolic ?? diastolic
    const rec = bpRecency
    if (sys && dia) {
      data.blood_pressure = {
        systolic: Number(sys),
        diastolic: Number(dia),
        measured_date: rec ? getDateFromRecency(rec) : undefined,
      }
    }

    // Include RHR if range is selected
    const range = updates.resting_heart_rate?.range ?? rhrRange
    if (range) {
      data.resting_heart_rate = { range }
    }

    onChange(data)
  }

  const handleCardioChange = (value: CardioSelfRating) => {
    setCardioRating(value)
    emitChange({ cardio_self_rating: value })
  }

  const handleRhrChange = (value: RhrRange) => {
    setRhrRange(value)
    emitChange({ resting_heart_rate: { range: value } })
  }

  const handleBpRecencyChange = (value: BpRecency) => {
    setBpRecency(value)
    emitChange({})
  }

  return (
    <div className="bg-white">
      {/* Apple Health Data Badge */}
      {appleHealthData && (appleHealthData.rhr || appleHealthData.hrv) && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {appleHealthData.rhr && (
            <span className="text-[12px] px-2 py-1 bg-[#34C759]/10 text-[#34C759] rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              RHR: {appleHealthData.rhr} bpm
            </span>
          )}
          {appleHealthData.hrv && (
            <span className="text-[12px] px-2 py-1 bg-[#34C759]/10 text-[#34C759] rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              HRV: {appleHealthData.hrv} ms
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Section 1: Cardio Self-Rating */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Compared to others your age, my cardio fitness is…
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CARDIO_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleCardioChange(opt.value)}
                className={`p-2.5 rounded-xl text-[14px] font-medium transition-all ${
                  cardioRating === opt.value
                    ? 'bg-[#FF2D55] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Blood Pressure - Simplified */}
        <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-[#3C3C43]">
              Blood pressure
            </label>
            <span className="text-[11px] text-[#8E8E93] bg-white px-2 py-0.5 rounded">
              optional · high value
            </span>
          </div>
          
          {/* BP Values - Side by side with slash */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={systolic}
              onChange={e => {
                const v = e.target.value ? Number(e.target.value) : ''
                setSystolic(v)
              }}
              onBlur={() => emitChange({})}
              placeholder="120"
              className="w-20 px-3 py-2.5 text-[17px] text-center text-black bg-white border border-[#C6C6C8] rounded-xl focus:border-[#FF2D55] outline-none"
            />
            <span className="text-[20px] text-[#8E8E93]">/</span>
            <input
              type="number"
              inputMode="numeric"
              value={diastolic}
              onChange={e => {
                const v = e.target.value ? Number(e.target.value) : ''
                setDiastolic(v)
              }}
              onBlur={() => emitChange({})}
              placeholder="80"
              className="w-20 px-3 py-2.5 text-[17px] text-center text-black bg-white border border-[#C6C6C8] rounded-xl focus:border-[#FF2D55] outline-none"
            />
            <span className="text-[14px] text-[#8E8E93] ml-1">mmHg</span>
          </div>

          {/* Recency - Only show if BP values entered */}
          {(systolic || diastolic) && (
            <div>
              <label className="block text-[11px] text-[#8E8E93] mb-2">When was this measured?</label>
              <div className="flex gap-2">
                {BP_RECENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleBpRecencyChange(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      bpRecency === opt.value
                        ? 'bg-[#FF2D55] text-white'
                        : 'bg-white text-[#3C3C43] border border-[#C6C6C8] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Resting Heart Rate - Simplified to just range buttons */}
        <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-[#3C3C43]">
              Resting heart rate
            </label>
            <span className="text-[11px] text-[#8E8E93] bg-white px-2 py-0.5 rounded">
              optional
            </span>
          </div>
          
          <p className="text-[12px] text-[#8E8E93]">
            Check your wearable or take your pulse for 60 seconds when you first wake up
          </p>
          
          <div className="grid grid-cols-5 gap-2">
            {RHR_RANGES.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRhrChange(opt.value)}
                className={`p-2.5 rounded-xl text-center transition-all ${
                  rhrRange === opt.value
                    ? 'bg-[#FF2D55] text-white'
                    : 'bg-white text-[#3C3C43] border border-[#C6C6C8] hover:bg-[#E5E5EA]'
                }`}
              >
                <span className="text-[14px] font-semibold block">{opt.label}</span>
                <span className={`text-[10px] ${rhrRange === opt.value ? 'text-white/70' : 'text-[#8E8E93]'}`}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
