'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EdenUserState } from '@/lib/onboarding/getUserState'
import {
  PrimeCheckJson,
  HeartPrimeCheck,
  FramePrimeCheck,
  MetabolismPrimeCheck,
  RecoveryPrimeCheck,
  MindPrimeCheck,
  PRIME_CHECK_SCHEMA_VERSION,
} from '@/lib/onboarding/types'
import HeartCard from './domain-cards/HeartCard'
import FrameCard from './domain-cards/FrameCard'
import MetabolismCard from './domain-cards/MetabolismCard'
import RecoveryCard from './domain-cards/RecoveryCard'
import MindCard from './domain-cards/MindCard'

interface Step5PrimeCheckProps {
  state: EdenUserState
}

interface AppleHealthData {
  heart?: { rhr?: number; hrv?: number }
  frame?: { weight?: number }
  recovery?: { avgSleepDuration?: number }
}

type DomainKey = 'heart' | 'frame' | 'metabolism' | 'recovery' | 'mind'

const DOMAIN_CONFIG: Record<DomainKey, { 
  name: string
  icon: React.ReactNode
  color: string
  bgColor: string
}> = {
  heart: {
    name: 'Heart',
    color: '#FF2D55',
    bgColor: 'bg-[#FF2D55]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  },
  frame: {
    name: 'Frame',
    color: '#5856D6',
    bgColor: 'bg-[#5856D6]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  },
  metabolism: {
    name: 'Metabolism',
    color: '#FF9500',
    bgColor: 'bg-[#FF9500]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
  recovery: {
    name: 'Recovery',
    color: '#34C759',
    bgColor: 'bg-[#34C759]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
  },
  mind: {
    name: 'Mind',
    color: '#007AFF',
    bgColor: 'bg-[#007AFF]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
  },
}

export default function Step5PrimeCheck({ state }: Step5PrimeCheckProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appleHealthData, setAppleHealthData] = useState<AppleHealthData>({})
  const [expandedDomain, setExpandedDomain] = useState<DomainKey | null>('heart')

  const initialPrimeCheck = (state.prime_check_json as PrimeCheckJson | null) || {
    schema_version: PRIME_CHECK_SCHEMA_VERSION,
  }

  const [heartData, setHeartData] = useState<HeartPrimeCheck>(initialPrimeCheck.heart || {})
  const [frameData, setFrameData] = useState<FramePrimeCheck>(initialPrimeCheck.frame || {})
  const [metabolismData, setMetabolismData] = useState<MetabolismPrimeCheck>(initialPrimeCheck.metabolism || {})
  const [recoveryData, setRecoveryData] = useState<RecoveryPrimeCheck>(initialPrimeCheck.recovery || {})
  const [mindData, setMindData] = useState<MindPrimeCheck>(initialPrimeCheck.mind || {})

  useEffect(() => {
    const loadAppleHealthData = async () => {
      try {
        const res = await fetch('/api/uploads/status')
        if (!res.ok) return
        const data = await res.json()
        if (data.appleHealth?.latest?.status === 'completed') {
          const metricsRes = await fetch('/api/apple-health/status')
          if (metricsRes.ok) {
            const metrics = await metricsRes.json()
            setAppleHealthData({
              heart: { rhr: metrics.latestMetrics?.resting_heart_rate, hrv: metrics.latestMetrics?.hrv },
              frame: { weight: metrics.latestMetrics?.weight },
              recovery: { avgSleepDuration: metrics.latestMetrics?.sleep_duration },
            })
          }
        }
      } catch (e) {
        console.error('Failed to load Apple Health data', e)
      }
    }
    loadAppleHealthData()
  }, [])

  // Domain completion status
  const isDomainComplete = (domain: DomainKey): boolean => {
    switch (domain) {
      case 'heart': return !!heartData.cardio_self_rating
      case 'frame': return !!(frameData.pushup_capability && (frameData.structural_integrity?.severity || frameData.pain_limitation))
      case 'metabolism': return !!(metabolismData.diagnoses?.length && metabolismData.family_history?.length && metabolismData.medications?.length)
      case 'recovery': return !!(recoveryData.sleep_duration && recoveryData.sleep_regularity !== undefined && recoveryData.insomnia_frequency)
      case 'mind': return !!(mindData.focus_check || (mindData.focus_stability && mindData.brain_fog))
    }
  }

  const completedCount = (['heart', 'frame', 'metabolism', 'recovery', 'mind'] as DomainKey[]).filter(isDomainComplete).length

  const validatePrimeCheck = (): string | null => {
    if (!isDomainComplete('heart')) return 'Complete the Heart section'
    if (!isDomainComplete('frame')) return 'Complete the Frame section'
    if (!isDomainComplete('metabolism')) return 'Complete the Metabolism section'
    if (!isDomainComplete('recovery')) return 'Complete the Recovery section'
    if (!isDomainComplete('mind')) return 'Complete the Mind section'
    return null
  }

  const handleNext = async () => {
    const validationError = validatePrimeCheck()
    if (validationError) {
      setError(validationError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setError(null)
    setSaving(true)

    try {
      const primeCheckJson: PrimeCheckJson = {
        heart: heartData,
        frame: frameData,
        metabolism: metabolismData,
        recovery: recoveryData,
        mind: mindData,
        schema_version: PRIME_CHECK_SCHEMA_VERSION,
        completed_at: new Date().toISOString(),
      }

      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 5,
          onboarding_status: 'in_progress',
          patch: { prime_check_json: primeCheckJson },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      router.push('/onboarding/6')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const toggleDomain = (domain: DomainKey) => {
    setExpandedDomain(expandedDomain === domain ? null : domain)
  }

  const DomainHeader = ({ domain }: { domain: DomainKey }) => {
    const config = DOMAIN_CONFIG[domain]
    const isComplete = isDomainComplete(domain)
    const isExpanded = expandedDomain === domain

    return (
      <button
        type="button"
        onClick={() => toggleDomain(domain)}
        className={`w-full flex items-center gap-3 p-4 transition-colors ${
          isExpanded ? 'bg-white' : 'bg-white hover:bg-[#F2F2F7]'
        }`}
      >
        <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {config.icon}
          </svg>
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-[16px] font-semibold text-black">{config.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="w-6 h-6 rounded-full bg-[#34C759] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          <svg
            className={`w-5 h-5 text-[#8E8E93] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-black">Quick health check</h2>
          <span className="text-[14px] font-medium text-[#8E8E93]">{completedCount}/5</span>
        </div>
        <div className="flex gap-1.5">
          {(['heart', 'frame', 'metabolism', 'recovery', 'mind'] as DomainKey[]).map(domain => (
            <div
              key={domain}
              className={`flex-1 h-2 rounded-full transition-colors ${
                isDomainComplete(domain) ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
              }`}
            />
          ))}
        </div>
        <p className="text-[13px] text-[#8E8E93] mt-3">
          Answer quick questions about each domain. Takes 2-3 minutes.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px] flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Domain Cards */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden divide-y divide-[#E5E5EA]">
        {/* Heart */}
        <div>
          <DomainHeader domain="heart" />
          <div
            className={`border-t border-[#E5E5EA] ${expandedDomain === 'heart' ? '' : 'hidden'}`}
          >
            <HeartCard
              initialData={heartData}
              appleHealthData={appleHealthData.heart}
              onChange={setHeartData}
            />
          </div>
        </div>

        {/* Frame */}
        <div>
          <DomainHeader domain="frame" />
          <div
            className={`border-t border-[#E5E5EA] ${expandedDomain === 'frame' ? '' : 'hidden'}`}
          >
            <FrameCard
              initialData={frameData}
              appleHealthData={appleHealthData.frame}
              onChange={setFrameData}
            />
          </div>
        </div>

        {/* Metabolism */}
        <div>
          <DomainHeader domain="metabolism" />
          <div
            className={`border-t border-[#E5E5EA] ${expandedDomain === 'metabolism' ? '' : 'hidden'}`}
          >
            <MetabolismCard
              initialData={metabolismData}
              onChange={setMetabolismData}
            />
          </div>
        </div>

        {/* Recovery */}
        <div>
          <DomainHeader domain="recovery" />
          <div
            className={`border-t border-[#E5E5EA] ${expandedDomain === 'recovery' ? '' : 'hidden'}`}
          >
            <RecoveryCard
              initialData={recoveryData}
              appleHealthData={appleHealthData.recovery}
              onChange={setRecoveryData}
            />
          </div>
        </div>

        {/* Mind */}
        <div>
          <DomainHeader domain="mind" />
          <div
            className={`border-t border-[#E5E5EA] ${expandedDomain === 'mind' ? '' : 'hidden'}`}
          >
            <MindCard
              initialData={mindData}
              onChange={setMindData}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => router.push('/onboarding/4')}
          className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
        >
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={saving || completedCount < 5}
          className={`py-3 px-6 rounded-xl text-[17px] font-semibold transition-colors ${
            completedCount === 5
              ? 'bg-[#007AFF] text-white hover:bg-[#0066DD] active:bg-[#0055CC]'
              : 'bg-[#E5E5EA] text-[#8E8E93]'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving…' : completedCount === 5 ? 'Generate Scorecard' : `${5 - completedCount} left`}
        </button>
      </div>
    </div>
  )
}
