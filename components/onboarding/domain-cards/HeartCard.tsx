'use client'

import { useState } from 'react'
import {
  CardioSelfRating,
  BloodPressureEntry,
  RestingHeartRateEntry,
  RhrRange,
  RhrSource,
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
  { value: 'slightly_below', label: 'Slightly below average' },
  { value: 'average', label: 'About average' },
  { value: 'slightly_above', label: 'Slightly above average' },
  { value: 'above_avg', label: 'Above average' },
  { value: 'not_sure', label: 'Not sure' },
]

const RHR_RANGES: { value: RhrRange; label: string }[] = [
  { value: '<55', label: '< 55 bpm' },
  { value: '55-64', label: '55-64 bpm' },
  { value: '65-74', label: '65-74 bpm' },
  { value: '75-84', label: '75-84 bpm' },
  { value: '85+', label: '85+ bpm' },
]

export default function HeartCard({ initialData, appleHealthData, onChange }: HeartCardProps) {
  const [cardioRating, setCardioRating] = useState<CardioSelfRating | undefined>(
    initialData?.cardio_self_rating
  )
  const [showBpInput, setShowBpInput] = useState(!!initialData?.blood_pressure)
  const [systolic, setSystolic] = useState<number | ''>(initialData?.blood_pressure?.systolic || '')
  const [diastolic, setDiastolic] = useState<number | ''>(initialData?.blood_pressure?.diastolic || '')
  const [bpDate, setBpDate] = useState(initialData?.blood_pressure?.measured_date || '')
  
  const [showRhrInput, setShowRhrInput] = useState(false)
  const [rhrBpm, setRhrBpm] = useState<number | ''>(initialData?.resting_heart_rate?.bpm || '')
  const [rhrRange, setRhrRange] = useState<RhrRange | undefined>(initialData?.resting_heart_rate?.range)
  const [rhrDate, setRhrDate] = useState(initialData?.resting_heart_rate?.measured_date || '')
  const [rhrSource, setRhrSource] = useState<RhrSource | undefined>(initialData?.resting_heart_rate?.source)

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

    // Include BP if values are present
    const sys = updates.blood_pressure?.systolic ?? systolic
    const dia = updates.blood_pressure?.diastolic ?? diastolic
    const bpD = updates.blood_pressure?.measured_date ?? bpDate
    if (sys && dia && bpD) {
      data.blood_pressure = {
        systolic: Number(sys),
        diastolic: Number(dia),
        measured_date: bpD,
      }
    }

    // Include RHR if values are present
    const rB = updates.resting_heart_rate?.bpm ?? rhrBpm
    const rR = updates.resting_heart_rate?.range ?? rhrRange
    if (rB || rR) {
      data.resting_heart_rate = {
        ...(rB ? { bpm: Number(rB) } : {}),
        ...(rR ? { range: rR } : {}),
        ...(rhrDate ? { measured_date: rhrDate } : {}),
        ...(rhrSource ? { source: rhrSource } : {}),
      }
    }

    onChange(data)
  }

  const handleCardioChange = (value: CardioSelfRating) => {
    setCardioRating(value)
    emitChange({ cardio_self_rating: value })
  }

  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#FF2D55]/10 to-[#FF2D55]/5 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF2D55] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-black">Heart</h3>
            <p className="text-[13px] text-[#8E8E93]">Cardiovascular health</p>
          </div>
        </div>

        {/* Apple Health Data Badge */}
        {appleHealthData && (appleHealthData.rhr || appleHealthData.hrv) && (
          <div className="mt-3 flex flex-wrap gap-2">
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
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Quick Check: Cardio Self-Rating */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Compared to others your age, my cardio fitness is…
          </label>
          <div className="space-y-2">
            {CARDIO_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleCardioChange(opt.value)}
                className={`w-full p-3 rounded-xl text-left text-[15px] font-medium transition-all ${
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

        {/* Add a measurement: Blood Pressure */}
        <div>
          <button
            type="button"
            onClick={() => setShowBpInput(!showBpInput)}
            className="flex items-center gap-2 text-[15px] text-[#007AFF] font-medium"
          >
            <span>{showBpInput ? '−' : '+'}</span>
            Add blood pressure
          </button>

          {showBpInput && (
            <div className="mt-3 p-4 bg-[#F2F2F7] rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">Systolic (mmHg)</label>
                  <input
                    type="number"
                    value={systolic}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setSystolic(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="120"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">Diastolic (mmHg)</label>
                  <input
                    type="number"
                    value={diastolic}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setDiastolic(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="80"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-[#8E8E93] mb-1">When was this measured?</label>
                <input
                  type="month"
                  value={bpDate}
                  onChange={e => {
                    setBpDate(e.target.value)
                    emitChange({})
                  }}
                  className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Add more accuracy: Resting Heart Rate */}
        <div>
          <button
            type="button"
            onClick={() => setShowRhrInput(!showRhrInput)}
            className="flex items-center gap-2 text-[14px] text-[#8E8E93]"
          >
            <span>{showRhrInput ? '−' : '+'}</span>
            Add resting heart rate for more accuracy
          </button>

          {showRhrInput && (
            <div className="mt-3 p-4 bg-[#F2F2F7] rounded-xl space-y-3">
              <div>
                <label className="block text-[12px] text-[#8E8E93] mb-1">Exact BPM (if known)</label>
                <input
                  type="number"
                  value={rhrBpm}
                  onChange={e => {
                    const v = e.target.value ? Number(e.target.value) : ''
                    setRhrBpm(v)
                  }}
                  onBlur={() => emitChange({})}
                  placeholder="65"
                  className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#8E8E93] mb-2">Or select a range</label>
                <div className="flex flex-wrap gap-2">
                  {RHR_RANGES.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setRhrRange(opt.value)
                        emitChange({ resting_heart_rate: { range: opt.value } })
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                        rhrRange === opt.value
                          ? 'bg-[#FF2D55] text-white'
                          : 'bg-white text-[#3C3C43] border border-[#C6C6C8]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">When? (optional)</label>
                  <input
                    type="month"
                    value={rhrDate}
                    onChange={e => {
                      setRhrDate(e.target.value)
                      emitChange({})
                    }}
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">Source (optional)</label>
                  <select
                    value={rhrSource || ''}
                    onChange={e => {
                      setRhrSource(e.target.value as RhrSource || undefined)
                      emitChange({})
                    }}
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="wearable">Wearable</option>
                    <option value="doctor">Doctor</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

