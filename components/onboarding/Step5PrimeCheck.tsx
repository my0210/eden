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
  heart?: {
    rhr?: number
    hrv?: number
  }
  frame?: {
    weight?: number
  }
  recovery?: {
    avgSleepDuration?: number
  }
}

export default function Step5PrimeCheck({ state }: Step5PrimeCheckProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appleHealthData, setAppleHealthData] = useState<AppleHealthData>({})

  // Initialize from existing state if available
  const initialPrimeCheck = (state.prime_check_json as PrimeCheckJson | null) || {
    schema_version: PRIME_CHECK_SCHEMA_VERSION,
  }

  // Domain data states
  const [heartData, setHeartData] = useState<HeartPrimeCheck>(initialPrimeCheck.heart || {})
  const [frameData, setFrameData] = useState<FramePrimeCheck>(initialPrimeCheck.frame || {})
  const [metabolismData, setMetabolismData] = useState<MetabolismPrimeCheck>(
    initialPrimeCheck.metabolism || {}
  )
  const [recoveryData, setRecoveryData] = useState<RecoveryPrimeCheck>(
    initialPrimeCheck.recovery || {}
  )
  const [mindData, setMindData] = useState<MindPrimeCheck>(initialPrimeCheck.mind || {})

  // Load Apple Health data if available
  useEffect(() => {
    const loadAppleHealthData = async () => {
      try {
        const res = await fetch('/api/uploads/status')
        if (!res.ok) return

        const data = await res.json()
        if (data.appleHealth?.latest?.status === 'completed') {
          // Fetch the actual metrics
          const metricsRes = await fetch('/api/apple-health/status')
          if (metricsRes.ok) {
            const metrics = await metricsRes.json()
            setAppleHealthData({
              heart: {
                rhr: metrics.latestMetrics?.resting_heart_rate,
                hrv: metrics.latestMetrics?.hrv,
              },
              frame: {
                weight: metrics.latestMetrics?.weight,
              },
              recovery: {
                avgSleepDuration: metrics.latestMetrics?.sleep_duration,
              },
            })
          }
        }
      } catch (e) {
        console.error('Failed to load Apple Health data', e)
      }
    }
    loadAppleHealthData()
  }, [])

  // Validation - at least one required field per domain
  const validatePrimeCheck = (): string | null => {
    if (!heartData.cardio_self_rating) {
      return 'Please rate your cardio fitness in the Heart section'
    }
    if (!frameData.pushup_capability) {
      return 'Please select your push-up capability in the Frame section'
    }
    if (!frameData.pain_limitation) {
      return 'Please select your pain level in the Frame section'
    }
    if (!metabolismData.diagnoses?.length) {
      return 'Please select diagnosed conditions in the Metabolism section'
    }
    if (!metabolismData.family_history?.length) {
      return 'Please select family history in the Metabolism section'
    }
    if (!metabolismData.medications?.length) {
      return 'Please select medications in the Metabolism section'
    }
    if (!recoveryData.sleep_duration) {
      return 'Please select your sleep duration in the Recovery section'
    }
    if (recoveryData.sleep_regularity === undefined) {
      return 'Please answer the sleep regularity question in the Recovery section'
    }
    if (!recoveryData.insomnia_frequency) {
      return 'Please select insomnia frequency in the Recovery section'
    }
    if (!mindData.focus_stability) {
      return 'Please rate your focus stability in the Mind section'
    }
    if (!mindData.brain_fog) {
      return 'Please rate brain fog frequency in the Mind section'
    }
    return null
  }

  const handleNext = async () => {
    const validationError = validatePrimeCheck()
    if (validationError) {
      setError(validationError)
      // Scroll to top to show error
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
          patch: {
            prime_check_json: primeCheckJson,
          },
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

  const handleBack = () => {
    router.push('/onboarding/4')
  }

  // Count completed domains
  const completedDomains = [
    heartData.cardio_self_rating,
    frameData.pushup_capability && frameData.pain_limitation,
    metabolismData.diagnoses?.length && metabolismData.family_history?.length,
    recoveryData.sleep_duration && recoveryData.insomnia_frequency,
    mindData.focus_stability && mindData.brain_fog,
  ].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-[15px] text-[#8E8E93]">
          Answer quick questions about each health domain. This takes about 2-3 minutes.
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="flex">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`w-6 h-2 rounded-full mx-0.5 transition-colors ${
                  i < completedDomains ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
                }`}
              />
            ))}
          </div>
          <span className="text-[13px] text-[#8E8E93]">{completedDomains}/5 completed</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
          {error}
        </div>
      )}

      {/* Domain Cards */}
      <div className="space-y-4">
        <HeartCard
          initialData={heartData}
          appleHealthData={appleHealthData.heart}
          onChange={setHeartData}
        />

        <FrameCard
          initialData={frameData}
          appleHealthData={appleHealthData.frame}
          onChange={setFrameData}
        />

        <MetabolismCard
          initialData={metabolismData}
          onChange={setMetabolismData}
        />

        <RecoveryCard
          initialData={recoveryData}
          appleHealthData={appleHealthData.recovery}
          onChange={setRecoveryData}
        />

        <MindCard
          initialData={mindData}
          onChange={setMindData}
        />
      </div>

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
          {saving ? 'Saving…' : 'Generate Scorecard'}
        </button>
      </div>
    </div>
  )
}

