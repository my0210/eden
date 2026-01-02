'use client'

import { useState, useEffect } from 'react'

interface IdentityData {
  age?: number
  sex_at_birth?: 'male' | 'female'
  height?: number // in cm
  weight?: number // in kg
  units?: 'metric' | 'imperial'
}

// =============================================================================
// Display Utilities
// =============================================================================

function formatHeight(cm: number | undefined, units: 'metric' | 'imperial' = 'metric'): string {
  if (!cm) return '—'
  if (units === 'imperial') {
    const totalInches = cm / 2.54
    const feet = Math.floor(totalInches / 12)
    const inches = Math.round(totalInches % 12)
    return `${feet}'${inches}"`
  }
  return `${cm} cm`
}

function formatWeight(kg: number | undefined, units: 'metric' | 'imperial' = 'metric'): string {
  if (!kg) return '—'
  if (units === 'imperial') {
    const lbs = Math.round(kg * 2.205)
    return `${lbs} lbs`
  }
  return `${kg} kg`
}

function formatSex(sex: string | undefined): string {
  if (!sex) return '—'
  return sex === 'male' ? 'Male' : 'Female'
}

// =============================================================================
// Edit Modal
// =============================================================================

function EditProfileModal({
  identity,
  onSave,
  onClose,
}: {
  identity: IdentityData
  onSave: (data: IdentityData) => Promise<void>
  onClose: () => void
}) {
  const [age, setAge] = useState<number | ''>(identity.age || '')
  const [sex, setSex] = useState<'male' | 'female' | ''>(identity.sex_at_birth || '')
  const [height, setHeight] = useState<number | ''>(identity.height || '')
  const [weight, setWeight] = useState<number | ''>(identity.weight || '')
  const [units, setUnits] = useState<'metric' | 'imperial'>(identity.units || 'metric')
  const [saving, setSaving] = useState(false)

  // Convert display values based on units
  const displayHeight = units === 'imperial' && height ? Math.round(Number(height) / 2.54) : height
  const displayWeight = units === 'imperial' && weight ? Math.round(Number(weight) * 2.205) : weight

  const handleHeightChange = (value: string) => {
    const num = parseInt(value) || ''
    if (units === 'imperial' && num) {
      // Convert inches to cm for storage
      setHeight(Math.round(Number(num) * 2.54))
    } else {
      setHeight(num as number | '')
    }
  }

  const handleWeightChange = (value: string) => {
    const num = parseFloat(value) || ''
    if (units === 'imperial' && num) {
      // Convert lbs to kg for storage
      setWeight(Math.round(Number(num) / 2.205 * 10) / 10)
    } else {
      setWeight(num as number | '')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        age: age || undefined,
        sex_at_birth: sex || undefined,
        height: height || undefined,
        weight: weight || undefined,
        units,
      })
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
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-[#E5E5EA] rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-5 pb-4 border-b border-[#E5E5EA]">
          <h2 className="text-[20px] font-bold text-black">Edit Profile</h2>
        </div>
        
        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Units Toggle */}
          <div>
            <label className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide block mb-2">
              Units
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setUnits('metric')}
                className={`flex-1 py-2 rounded-lg text-[15px] font-medium transition-colors ${
                  units === 'metric' 
                    ? 'bg-[#007AFF] text-white' 
                    : 'bg-[#F2F2F7] text-[#3C3C43]'
                }`}
              >
                Metric
              </button>
              <button
                onClick={() => setUnits('imperial')}
                className={`flex-1 py-2 rounded-lg text-[15px] font-medium transition-colors ${
                  units === 'imperial' 
                    ? 'bg-[#007AFF] text-white' 
                    : 'bg-[#F2F2F7] text-[#3C3C43]'
                }`}
              >
                Imperial
              </button>
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide block mb-2">
              Age
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(parseInt(e.target.value) || '')}
              placeholder="Enter age"
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl text-[17px] text-black placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>

          {/* Sex */}
          <div>
            <label className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide block mb-2">
              Sex at Birth
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSex('male')}
                className={`flex-1 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                  sex === 'male' 
                    ? 'bg-[#007AFF] text-white' 
                    : 'bg-[#F2F2F7] text-[#3C3C43]'
                }`}
              >
                Male
              </button>
              <button
                onClick={() => setSex('female')}
                className={`flex-1 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                  sex === 'female' 
                    ? 'bg-[#007AFF] text-white' 
                    : 'bg-[#F2F2F7] text-[#3C3C43]'
                }`}
              >
                Female
              </button>
            </div>
          </div>

          {/* Height */}
          <div>
            <label className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide block mb-2">
              Height {units === 'imperial' ? '(inches)' : '(cm)'}
            </label>
            <input
              type="number"
              value={displayHeight}
              onChange={(e) => handleHeightChange(e.target.value)}
              placeholder={units === 'imperial' ? 'e.g., 70' : 'e.g., 178'}
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl text-[17px] text-black placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide block mb-2">
              Weight {units === 'imperial' ? '(lbs)' : '(kg)'}
            </label>
            <input
              type="number"
              step="0.1"
              value={displayWeight}
              onChange={(e) => handleWeightChange(e.target.value)}
              placeholder={units === 'imperial' ? 'e.g., 170' : 'e.g., 77'}
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl text-[17px] text-black placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>
        </div>
        
        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#E5E5EA] flex gap-3">
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
// Main Component
// =============================================================================

export default function ProfileSection() {
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    loadIdentity()
  }, [])

  async function loadIdentity() {
    try {
      const res = await fetch('/api/onboarding/state')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setIdentity(data.identity_json || {})
    } catch (err) {
      console.error('Load error:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(data: IdentityData) {
    const res = await fetch('/api/onboarding/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 3, // Identity step
        patch: {
          identity_json: data,
        },
      }),
    })

    if (!res.ok) {
      throw new Error('Save failed')
    }

    setIdentity(data)
    
    // Trigger scorecard refresh (height/weight affect BMI calculations)
    window.dispatchEvent(new Event('scorecard-updated'))
  }

  if (loading) {
    return (
      <section>
        <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
          Profile
        </h2>
        <div className="bg-white rounded-xl border border-[#E5E5EA] p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-[#E5E5EA] rounded w-1/3" />
            <div className="h-4 bg-[#E5E5EA] rounded w-1/2" />
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
          Profile
        </h2>
        <div className="bg-white rounded-xl border border-[#E5E5EA] p-4">
          <p className="text-[14px] text-[#FF3B30]">{error}</p>
          <button onClick={loadIdentity} className="text-[14px] text-[#007AFF] mt-2">
            Try again
          </button>
        </div>
      </section>
    )
  }

  const units = identity?.units || 'metric'

  return (
    <section>
      <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
        Profile
      </h2>
      
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-4">
        <div className="flex items-start justify-between">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 flex-1">
            <div>
              <span className="text-[13px] text-[#8E8E93]">Age</span>
              <p className="text-[15px] text-black font-medium">{identity?.age || '—'}</p>
            </div>
            <div>
              <span className="text-[13px] text-[#8E8E93]">Sex</span>
              <p className="text-[15px] text-black font-medium">{formatSex(identity?.sex_at_birth)}</p>
            </div>
            <div>
              <span className="text-[13px] text-[#8E8E93]">Height</span>
              <p className="text-[15px] text-black font-medium">{formatHeight(identity?.height, units)}</p>
            </div>
            <div>
              <span className="text-[13px] text-[#8E8E93]">Weight</span>
              <p className="text-[15px] text-black font-medium">{formatWeight(identity?.weight, units)}</p>
            </div>
          </div>
          
          <button
            onClick={() => setEditing(true)}
            className="text-[15px] text-[#007AFF] font-medium hover:opacity-70 transition-opacity"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && identity && (
        <EditProfileModal
          identity={identity}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  )
}

