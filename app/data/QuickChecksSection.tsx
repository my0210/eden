'use client'

import { useState, useEffect } from 'react'
import {
  PrimeCheckJson,
  HeartPrimeCheck,
  FramePrimeCheck,
  MetabolismPrimeCheck,
  RecoveryPrimeCheck,
  MindPrimeCheck,
  PRIME_CHECK_SCHEMA_VERSION,
  CardioSelfRating,
  PushupCapability,
  SleepDuration,
  InsomniaFrequency,
  FocusStability,
  BrainFogFrequency,
  LimitationSeverity,
  MetabolismDiagnosis,
} from '@/lib/onboarding/types'
import HeartCard from '@/components/onboarding/domain-cards/HeartCard'
import FrameCard from '@/components/onboarding/domain-cards/FrameCard'
import MetabolismCard from '@/components/onboarding/domain-cards/MetabolismCard'
import RecoveryCard from '@/components/onboarding/domain-cards/RecoveryCard'
import MindCard from '@/components/onboarding/domain-cards/MindCard'

// =============================================================================
// Display Utilities (inline to avoid extra file)
// =============================================================================

const CARDIO_LABELS: Record<CardioSelfRating, string> = {
  'below_avg': 'Below average',
  'slightly_below': 'Slightly below average',
  'average': 'Average',
  'slightly_above': 'Slightly above average',
  'above_avg': 'Above average',
  'not_sure': 'Not sure',
}

const PUSHUP_LABELS: Record<PushupCapability, string> = {
  '0-5': '0-5 pushups',
  '6-15': '6-15 pushups',
  '16-30': '16-30 pushups',
  '31+': '31+ pushups',
  'not_possible': 'Unable to do pushups',
}

const SLEEP_LABELS: Record<SleepDuration, string> = {
  '<6h': 'Less than 6 hours',
  '6-7h': '6-7 hours',
  '7-8h': '7-8 hours',
  '8h+': '8+ hours',
}

const INSOMNIA_LABELS: Record<InsomniaFrequency, string> = {
  '<1': 'Rarely (< 1x/week)',
  '1-2': '1-2 times/week',
  '3-4': '3-4 times/week',
  '5+': '5+ times/week',
}

const FOCUS_LABELS: Record<FocusStability, string> = {
  'very_unstable': 'Very unstable',
  'somewhat_unstable': 'Somewhat unstable',
  'mostly_stable': 'Mostly stable',
  'very_stable': 'Very stable',
}

const BRAIN_FOG_LABELS: Record<BrainFogFrequency, string> = {
  'rarely': 'Rarely',
  'sometimes': 'Sometimes',
  'often': 'Often',
}

const LIMITATION_LABELS: Record<LimitationSeverity, string> = {
  'none': 'No limitations',
  'mild': 'Mild limitations',
  'moderate': 'Moderate limitations',
  'severe': 'Severe limitations',
}

const DIAGNOSIS_LABELS: Record<MetabolismDiagnosis, string> = {
  'none': 'None',
  'unsure': 'Unsure',
  'prediabetes': 'Prediabetes',
  'diabetes': 'Diabetes',
  'high_cholesterol': 'High cholesterol',
  'high_apob': 'High ApoB',
  'high_ldl': 'High LDL',
  'fatty_liver': 'Fatty liver',
  'high_blood_pressure': 'High blood pressure',
}

// =============================================================================
// Types
// =============================================================================

type DomainKey = 'heart' | 'frame' | 'metabolism' | 'recovery' | 'mind'

interface DomainConfig {
  name: string
  icon: string
  color: string
}

const DOMAIN_CONFIG: Record<DomainKey, DomainConfig> = {
  heart: { name: 'Heart', icon: '❤️', color: '#FF2D55' },
  frame: { name: 'Frame', icon: '🏋️', color: '#5856D6' },
  metabolism: { name: 'Metabolism', icon: '⚡', color: '#FF9500' },
  recovery: { name: 'Recovery', icon: '🌙', color: '#34C759' },
  mind: { name: 'Mind', icon: '🧠', color: '#007AFF' },
}

// =============================================================================
// Edit Modal Component
// =============================================================================

function EditModal({
  domain,
  primeCheck,
  onSave,
  onClose,
}: {
  domain: DomainKey
  primeCheck: PrimeCheckJson
  onSave: (domain: DomainKey, data: unknown) => Promise<void>
  onClose: () => void
}) {
  const [localData, setLocalData] = useState<unknown>(primeCheck[domain] || {})
  const [saving, setSaving] = useState(false)
  const config = DOMAIN_CONFIG[domain]

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(domain, localData)
      onClose()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-[#E5E5EA] rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-5 pb-3 border-b border-[#E5E5EA] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <span className="text-xl">{config.icon}</span>
            </div>
            <h2 className="text-[20px] font-bold text-black">Edit {config.name}</h2>
          </div>
        </div>
        
        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto">
          {domain === 'heart' && (
            <HeartCard
              initialData={primeCheck.heart}
              onChange={(data) => setLocalData(data)}
            />
          )}
          {domain === 'frame' && (
            <FrameCard
              initialData={primeCheck.frame}
              onChange={(data) => setLocalData(data)}
            />
          )}
          {domain === 'metabolism' && (
            <MetabolismCard
              initialData={primeCheck.metabolism}
              onChange={(data) => setLocalData(data)}
            />
          )}
          {domain === 'recovery' && (
            <RecoveryCard
              initialData={primeCheck.recovery}
              onChange={(data) => setLocalData(data)}
            />
          )}
          {domain === 'mind' && (
            <MindCard
              initialData={primeCheck.mind}
              onChange={(data) => setLocalData(data)}
            />
          )}
        </div>
        
        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#E5E5EA] flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-[#F2F2F7] rounded-xl text-[17px] font-semibold text-[#3C3C43] active:bg-[#E5E5EA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-[#007AFF] rounded-xl text-[17px] font-semibold text-white active:bg-[#0066DD] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Domain Summary Cards
// =============================================================================

function HeartSummary({ data }: { data?: HeartPrimeCheck }) {
  if (!data || (!data.cardio_self_rating && !data.blood_pressure && !data.resting_heart_rate)) {
    return <p className="text-[14px] text-[#8E8E93]">No answers yet</p>
  }

  return (
    <div className="space-y-1">
      {data.cardio_self_rating && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Cardio fitness:</span> {CARDIO_LABELS[data.cardio_self_rating]}
        </p>
      )}
      {data.blood_pressure && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Blood pressure:</span> {data.blood_pressure.systolic}/{data.blood_pressure.diastolic} mmHg
        </p>
      )}
      {data.resting_heart_rate && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Resting HR:</span> {data.resting_heart_rate.bpm ? `${data.resting_heart_rate.bpm} bpm` : data.resting_heart_rate.range}
        </p>
      )}
    </div>
  )
}

function FrameSummary({ data }: { data?: FramePrimeCheck }) {
  if (!data || (!data.pushup_capability && !data.structural_integrity && !data.waist_cm)) {
    return <p className="text-[14px] text-[#8E8E93]">No answers yet</p>
  }

  return (
    <div className="space-y-1">
      {data.pushup_capability && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Pushups:</span> {PUSHUP_LABELS[data.pushup_capability]}
        </p>
      )}
      {data.structural_integrity && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Physical limitations:</span> {LIMITATION_LABELS[data.structural_integrity.severity]}
        </p>
      )}
      {data.waist_cm && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Waist:</span> {data.waist_cm} cm
        </p>
      )}
      {data.photo_analysis && (
        <p className="text-[14px] text-[#34C759]">
          ✓ Body photo analyzed
        </p>
      )}
    </div>
  )
}

function MetabolismSummary({ data }: { data?: MetabolismPrimeCheck }) {
  if (!data || (!data.diagnoses?.length && !data.family_history?.length && !data.medications?.length)) {
    return <p className="text-[14px] text-[#8E8E93]">No answers yet</p>
  }

  const diagnoses = data.diagnoses?.filter(d => d !== 'none') || []
  const hasLabs = data.labs && (data.labs.apob_mg_dl || data.labs.hba1c_percent || data.labs.hscrp_mg_l)

  return (
    <div className="space-y-1">
      {diagnoses.length > 0 ? (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Conditions:</span> {diagnoses.map(d => DIAGNOSIS_LABELS[d]).join(', ')}
        </p>
      ) : (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Conditions:</span> None reported
        </p>
      )}
      {hasLabs && (
        <p className="text-[14px] text-[#34C759]">
          ✓ Lab values entered
        </p>
      )}
    </div>
  )
}

function RecoverySummary({ data }: { data?: RecoveryPrimeCheck }) {
  if (!data || (!data.sleep_duration && data.sleep_regularity === undefined && !data.insomnia_frequency)) {
    return <p className="text-[14px] text-[#8E8E93]">No answers yet</p>
  }

  return (
    <div className="space-y-1">
      {data.sleep_duration && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Sleep:</span> {SLEEP_LABELS[data.sleep_duration]}
        </p>
      )}
      {data.sleep_regularity !== undefined && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Regular schedule:</span> {data.sleep_regularity ? 'Yes' : 'No'}
        </p>
      )}
      {data.insomnia_frequency && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Trouble sleeping:</span> {INSOMNIA_LABELS[data.insomnia_frequency]}
        </p>
      )}
    </div>
  )
}

function MindSummary({ data }: { data?: MindPrimeCheck }) {
  if (!data || (!data.focus_check && !data.focus_stability && !data.brain_fog)) {
    return <p className="text-[14px] text-[#8E8E93]">No answers yet</p>
  }

  return (
    <div className="space-y-1">
      {data.focus_check && (
        <p className="text-[14px] text-[#34C759]">
          ✓ Focus Check completed ({data.focus_check.median_rt_ms}ms median)
        </p>
      )}
      {data.focus_stability && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Focus stability:</span> {FOCUS_LABELS[data.focus_stability]}
        </p>
      )}
      {data.brain_fog && (
        <p className="text-[14px] text-[#3C3C43]">
          <span className="text-[#8E8E93]">Brain fog:</span> {BRAIN_FOG_LABELS[data.brain_fog]}
        </p>
      )}
    </div>
  )
}

// =============================================================================
// Domain Card Component
// =============================================================================

function DomainSummaryCard({
  domain,
  primeCheck,
  onEdit,
}: {
  domain: DomainKey
  primeCheck: PrimeCheckJson
  onEdit: () => void
}) {
  const config = DOMAIN_CONFIG[domain]

  return (
    <div className="bg-white rounded-xl border border-[#E5E5EA] p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <span className="text-base">{config.icon}</span>
          </div>
          <h3 className="text-[17px] font-semibold text-black">{config.name}</h3>
        </div>
        <button
          onClick={onEdit}
          className="text-[15px] text-[#007AFF] font-medium hover:opacity-70 transition-opacity"
        >
          Edit
        </button>
      </div>
      
      <div className="pl-10">
        {domain === 'heart' && <HeartSummary data={primeCheck.heart} />}
        {domain === 'frame' && <FrameSummary data={primeCheck.frame} />}
        {domain === 'metabolism' && <MetabolismSummary data={primeCheck.metabolism} />}
        {domain === 'recovery' && <RecoverySummary data={primeCheck.recovery} />}
        {domain === 'mind' && <MindSummary data={primeCheck.mind} />}
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export default function QuickChecksSection() {
  const [primeCheck, setPrimeCheck] = useState<PrimeCheckJson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingDomain, setEditingDomain] = useState<DomainKey | null>(null)

  useEffect(() => {
    loadState()
  }, [])

  async function loadState() {
    try {
      const res = await fetch('/api/onboarding/state')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPrimeCheck(data.prime_check_json || { schema_version: PRIME_CHECK_SCHEMA_VERSION })
    } catch (err) {
      console.error('Load error:', err)
      setError('Failed to load your answers')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(domain: DomainKey, data: unknown) {
    if (!primeCheck) return

    const updatedPrimeCheck: PrimeCheckJson = {
      ...primeCheck,
      [domain]: data,
    }

    // Save to backend
    const res = await fetch('/api/onboarding/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 5, // Prime Check step
        patch: {
          prime_check_json: updatedPrimeCheck,
        },
      }),
    })

    if (!res.ok) {
      throw new Error('Save failed')
    }

    // Update local state
    setPrimeCheck(updatedPrimeCheck)

    // Trigger scorecard refresh
    window.dispatchEvent(new Event('scorecard-updated'))
  }

  if (loading) {
    return (
      <section>
        <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
          Quick Checks
        </h2>
        <div className="bg-white rounded-xl border border-[#E5E5EA] p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-[#E5E5EA] rounded w-1/3" />
            <div className="h-4 bg-[#E5E5EA] rounded w-2/3" />
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
          Quick Checks
        </h2>
        <div className="bg-white rounded-xl border border-[#E5E5EA] p-4">
          <p className="text-[14px] text-[#FF3B30]">{error}</p>
          <button 
            onClick={loadState}
            className="text-[14px] text-[#007AFF] mt-2"
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (!primeCheck) return null

  const domains: DomainKey[] = ['heart', 'frame', 'metabolism', 'recovery', 'mind']

  return (
    <section>
      <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
        Quick Checks
      </h2>
      <p className="text-[14px] text-[#8E8E93] mb-3">
        Answers from your onboarding. Edit anytime to update your scores.
      </p>
      
      <div className="space-y-2">
        {domains.map((domain) => (
          <DomainSummaryCard
            key={domain}
            domain={domain}
            primeCheck={primeCheck}
            onEdit={() => setEditingDomain(domain)}
          />
        ))}
      </div>

      {/* Edit Modal */}
      {editingDomain && (
        <EditModal
          domain={editingDomain}
          primeCheck={primeCheck}
          onSave={handleSave}
          onClose={() => setEditingDomain(null)}
        />
      )}
    </section>
  )
}

