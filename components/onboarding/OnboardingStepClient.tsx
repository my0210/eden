'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { EdenUserState } from '@/lib/onboarding/getUserState'

interface OnboardingStepClientProps {
  step: number
  state: EdenUserState
}

// Domain options for behaviors
const DOMAINS = [
  { key: 'exercise', label: 'Exercise & Movement' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'stress', label: 'Stress & Recovery' },
  { key: 'social', label: 'Social Connection' },
]

export default function OnboardingStepClient({ step, state }: OnboardingStepClientProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 2: Goals
  const [goalCategory, setGoalCategory] = useState(state.goals_json?.goalCategory || '')
  const [horizon, setHorizon] = useState<number>(state.goals_json?.horizon || 0)
  const [priorityDomains, setPriorityDomains] = useState<string[]>(state.goals_json?.priorityDomains || [])

  // Step 3: Data upload
  const existingImportId = state.identity_json?.data_sources?.appleHealthImportId || null
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>(existingImportId ? 'success' : 'idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importId, setImportId] = useState<string | null>(existingImportId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 4: Identity
  const [age, setAge] = useState<number | ''>(state.identity_json?.age || '')
  const [sexAtBirth, setSexAtBirth] = useState(state.identity_json?.sexAtBirth || '')
  const [heightCm, setHeightCm] = useState<number | ''>(state.identity_json?.heightCm || '')
  const [weightKg, setWeightKg] = useState<number | ''>(state.identity_json?.weightKg || '')
  const [timezone, setTimezone] = useState(state.identity_json?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [location, setLocation] = useState(state.identity_json?.location || '')
  const [workStyle, setWorkStyle] = useState(state.identity_json?.workStyle || '')
  const [freeTimeWindows, setFreeTimeWindows] = useState<string[]>(state.identity_json?.freeTimeWindows || [])

  // Step 5: Safety - show "none" if array is empty, otherwise join
  const formatArrayOrNone = (arr: string[] | undefined | null): string => {
    if (!arr) return ''
    if (arr.length === 0) return 'none'
    return arr.join(', ')
  }
  const [diagnoses, setDiagnoses] = useState<string>(formatArrayOrNone(state.safety_json?.diagnoses))
  const [meds, setMeds] = useState<string>(formatArrayOrNone(state.safety_json?.meds))
  const [injuriesYesNo, setInjuriesYesNo] = useState<'yes' | 'no' | ''>(state.safety_json?.injuriesYesNo || '')
  const [injuryDetails, setInjuryDetails] = useState(state.safety_json?.injuryDetails || '')
  const [redLines, setRedLines] = useState(state.safety_json?.redLines === null ? 'none' : (state.safety_json?.redLines || ''))
  const [doctorRestrictionsYesNo, setDoctorRestrictionsYesNo] = useState<'yes' | 'no' | ''>(state.safety_json?.doctorRestrictionsYesNo || '')
  const [doctorRestrictionDetails, setDoctorRestrictionDetails] = useState(state.safety_json?.doctorRestrictionDetails || '')

  // Step 6: Behaviors
  const [domainSelections, setDomainSelections] = useState<Record<string, string>>(state.behaviors_json?.domainSelections || {})
  const [timeBudget, setTimeBudget] = useState(state.behaviors_json?.timeBudget || '')

  // Step 7: Coaching
  const [tone, setTone] = useState(state.coaching_json?.tone || '')
  const [cadence, setCadence] = useState(state.coaching_json?.cadence || '')
  const [nudgeStyle, setNudgeStyle] = useState(state.coaching_json?.nudgeStyle || '')
  const [commitment, setCommitment] = useState<number>(state.coaching_json?.commitment || 5)
  const [whyNow, setWhyNow] = useState(state.coaching_json?.whyNow || '')

  const togglePriorityDomain = (domain: string) => {
    setPriorityDomains(prev => {
      if (prev.includes(domain)) {
        return prev.filter(d => d !== domain)
      }
      if (prev.length < 2) {
        return [...prev, domain]
      }
      return prev
    })
  }

  const toggleFreeTimeWindow = (window: string) => {
    setFreeTimeWindows(prev => {
      if (prev.includes(window)) {
        return prev.filter(w => w !== window)
      }
      return [...prev, window]
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.zip')) {
      setUploadError('Please upload a .zip file exported from Apple Health')
      setUploadStatus('error')
      return
    }

    setUploadStatus('uploading')
    setUploadError(null)

    try {
      // Step 1: Get signed upload URL
      const signedUrlRes = await fetch(`/api/apple-health/upload?filename=${encodeURIComponent(file.name)}`)
      const signedUrlData = await signedUrlRes.json()

      if (!signedUrlRes.ok) {
        setUploadError(signedUrlData.error || 'Failed to prepare upload')
        setUploadStatus('error')
        return
      }

      // Step 2: Upload directly to Supabase Storage using signed URL
      const uploadRes = await fetch(signedUrlData.signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/zip',
        },
      })

      if (!uploadRes.ok) {
        setUploadError('Upload failed. Please try again.')
        setUploadStatus('error')
        return
      }

      // Step 3: Confirm upload and create import record
      const confirmRes = await fetch('/api/apple-health/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: signedUrlData.filePath,
          fileSize: file.size,
        }),
      })

      const confirmData = await confirmRes.json()

      if (confirmRes.ok) {
        setImportId(confirmData.importId)
        setUploadStatus('success')
      } else {
        setUploadError(confirmData.error || 'Failed to record upload')
        setUploadStatus('error')
      }
    } catch {
      setUploadError('Something went wrong')
      setUploadStatus('error')
    }
  }

  const validateStep = (): string | null => {
    switch (step) {
      case 2:
        if (!goalCategory) return 'Please select a goal category'
        if (!horizon) return 'Please select a time horizon'
        if (priorityDomains.length < 1 || priorityDomains.length > 2) return 'Please select 1-2 priority domains'
        break
      case 4:
        if (!age) return 'Please enter your age'
        if (!sexAtBirth) return 'Please select sex at birth'
        if (!heightCm) return 'Please enter your height'
        if (!weightKg) return 'Please enter your weight'
        if (!timezone) return 'Please select your timezone'
        if (!location) return 'Please enter your location'
        if (!workStyle) return 'Please select your work style'
        if (freeTimeWindows.length === 0) return 'Please select at least one free time window'
        break
      case 5:
        if (!diagnoses) return 'Please enter diagnoses or "none"'
        if (!meds) return 'Please enter medications or "none"'
        if (!injuriesYesNo) return 'Please indicate if you have injuries'
        if (injuriesYesNo === 'yes' && !injuryDetails) return 'Please describe your injuries'
        if (!redLines) return 'Please enter red lines or "none"'
        if (!doctorRestrictionsYesNo) return 'Please indicate if you have doctor restrictions'
        if (doctorRestrictionsYesNo === 'yes' && !doctorRestrictionDetails) return 'Please describe your restrictions'
        break
      case 6:
        for (const domain of DOMAINS) {
          if (!domainSelections[domain.key]) return `Please answer for ${domain.label}`
        }
        if (!timeBudget) return 'Please select your time budget'
        break
      case 7:
        if (!tone) return 'Please select a coaching tone'
        if (!cadence) return 'Please select a check-in cadence'
        if (!nudgeStyle) return 'Please select a nudge style'
        if (!whyNow) return 'Please share what brought you here (or select "prefer not to say")'
        break
    }
    return null
  }

  const buildPatch = () => {
    switch (step) {
      case 1:
        return {}
      case 2:
        return {
          goals_json: { goalCategory, horizon, priorityDomains }
        }
      case 3:
        if (importId) {
          return {
            identity_json: {
              data_sources: { appleHealthImportId: importId }
            }
          }
        }
        return {}
      case 4:
        return {
          identity_json: {
            age: Number(age),
            sexAtBirth,
            heightCm: Number(heightCm),
            weightKg: Number(weightKg),
            timezone,
            location,
            workStyle,
            freeTimeWindows,
            ...(importId ? { data_sources: { appleHealthImportId: importId } } : {})
          }
        }
      case 5:
        return {
          safety_json: {
            diagnoses: diagnoses.toLowerCase() === 'none' ? [] : diagnoses.split(',').map(s => s.trim()).filter(Boolean),
            meds: meds.toLowerCase() === 'none' ? [] : meds.split(',').map(s => s.trim()).filter(Boolean),
            injuriesYesNo,
            injuryDetails: injuriesYesNo === 'yes' ? injuryDetails : null,
            redLines: redLines.toLowerCase() === 'none' ? null : redLines,
            doctorRestrictionsYesNo,
            doctorRestrictionDetails: doctorRestrictionsYesNo === 'yes' ? doctorRestrictionDetails : null,
          }
        }
      case 6:
        return {
          behaviors_json: { domainSelections, timeBudget }
        }
      case 7:
        return {
          coaching_json: { tone, cadence, nudgeStyle, commitment, whyNow }
        }
      default:
        return {}
    }
  }

  const handleNext = async () => {
    // Step 1 doesn't need validation
    if (step > 1) {
      const validationError = validateStep()
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setError(null)
    setSaving(true)

    try {
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          onboarding_status: step === 7 ? 'profile_complete' : 'in_progress',
          patch: buildPatch(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      // Navigate to next step
      router.push(`/onboarding/${step + 1}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    router.push(`/onboarding/${step - 1}`)
  }

  const handleSkipStep3 = async () => {
    setSaving(true)
    try {
      await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 3,
          onboarding_status: 'in_progress',
          patch: {},
        }),
      })
      router.push('/onboarding/4')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Welcome */}
      {step === 1 && (
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-2xl bg-[#007AFF] flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-3xl font-bold text-white">E</span>
          </div>
          <p className="text-[17px] text-[#3C3C43] mb-4">
            Welcome! Eden is your personal health coach, powered by AI and guided by your data.
          </p>
          <p className="text-[15px] text-[#8E8E93]">
            Over the next few steps, we&apos;ll learn about you so we can provide truly personalized coaching from day one.
          </p>
        </div>
      )}

      {/* Step 2: Goals */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              What&apos;s your main goal?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['Longevity', 'Performance', 'Weight Loss', 'Energy', 'Mental Health', 'General Wellness'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGoalCategory(cat)}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    goalCategory === cat
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Time horizon
            </label>
            <div className="flex gap-3">
              {[3, 6, 12].map(months => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setHorizon(months)}
                  className={`flex-1 p-3 rounded-xl text-[15px] font-medium transition-all ${
                    horizon === months
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {months} months
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Priority domains (select 1-2)
            </label>
            <div className="space-y-2">
              {DOMAINS.map(domain => (
                <button
                  key={domain.key}
                  type="button"
                  onClick={() => togglePriorityDomain(domain.key)}
                  className={`w-full p-3 rounded-xl text-left text-[15px] font-medium transition-all ${
                    priorityDomains.includes(domain.key)
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {domain.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Data Upload */}
      {step === 3 && (
        <div className="space-y-6">
          <p className="text-[15px] text-[#8E8E93]">
            Import your Apple Health data to get personalized insights. Export your data from the Health app on your iPhone.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === 'uploading'}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 text-[17px] font-medium text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
          >
            {uploadStatus === 'uploading' ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Apple Health Export (.zip)
              </>
            )}
          </button>

          {uploadStatus === 'success' && (
            <div className="p-4 rounded-xl bg-[#34C759]/10 text-[#34C759] text-[15px]">
              ✓ Upload complete. You can continue.
            </div>
          )}

          {uploadStatus === 'error' && uploadError && (
            <div className="p-4 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
              {uploadError}
            </div>
          )}

          <button
            onClick={handleSkipStep3}
            disabled={saving}
            className="w-full text-[15px] text-[#8E8E93] hover:text-[#3C3C43] transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Step 4: Identity */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
                placeholder="30"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Sex at birth
              </label>
              <select
                value={sexAtBirth}
                onChange={e => setSexAtBirth(e.target.value)}
                className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Height (cm)
              </label>
              <input
                type="number"
                value={heightCm}
                onChange={e => setHeightCm(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
                placeholder="175"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Weight (kg)
              </label>
              <input
                type="number"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
                placeholder="70"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
            >
              {Intl.supportedValuesOf('timeZone').map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Location (City, Country)
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
              placeholder="London, UK"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Work style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Remote', 'Office', 'Hybrid'].map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setWorkStyle(style)}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    workStyle === style
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Free time windows (select all that apply)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Early Morning', 'Morning', 'Lunch', 'Afternoon', 'Evening', 'Night'].map(window => (
                <button
                  key={window}
                  type="button"
                  onClick={() => toggleFreeTimeWindow(window)}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    freeTimeWindows.includes(window)
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {window}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Safety */}
      {step === 5 && (
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Diagnosed conditions (comma-separated, or &quot;none&quot;)
            </label>
            <input
              type="text"
              value={diagnoses}
              onChange={e => setDiagnoses(e.target.value)}
              className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
              placeholder="none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Current medications (comma-separated, or &quot;none&quot;)
            </label>
            <input
              type="text"
              value={meds}
              onChange={e => setMeds(e.target.value)}
              className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
              placeholder="none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Do you have any injuries or physical limitations?
            </label>
            <div className="flex gap-3">
              {(['yes', 'no'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInjuriesYesNo(opt)}
                  className={`flex-1 p-3 rounded-xl text-[15px] font-medium transition-all ${
                    injuriesYesNo === opt
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {opt === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
            {injuriesYesNo === 'yes' && (
              <textarea
                value={injuryDetails}
                onChange={e => setInjuryDetails(e.target.value)}
                className="mt-3 w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none resize-none"
                rows={2}
                placeholder="Please describe..."
              />
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Red lines (things you absolutely won&apos;t do, or &quot;none&quot;)
            </label>
            <input
              type="text"
              value={redLines}
              onChange={e => setRedLines(e.target.value)}
              className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none"
              placeholder="none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Do you have any doctor restrictions?
            </label>
            <div className="flex gap-3">
              {(['yes', 'no'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDoctorRestrictionsYesNo(opt)}
                  className={`flex-1 p-3 rounded-xl text-[15px] font-medium transition-all ${
                    doctorRestrictionsYesNo === opt
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {opt === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
            {doctorRestrictionsYesNo === 'yes' && (
              <textarea
                value={doctorRestrictionDetails}
                onChange={e => setDoctorRestrictionDetails(e.target.value)}
                className="mt-3 w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none resize-none"
                rows={2}
                placeholder="Please describe..."
              />
            )}
          </div>
        </div>
      )}

      {/* Step 6: Behaviors */}
      {step === 6 && (
        <div className="space-y-4">
          <p className="text-[15px] text-[#8E8E93] mb-4">
            Tell us about your current habits in each domain.
          </p>

          {DOMAINS.map(domain => (
            <div key={domain.key}>
              <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                {domain.label}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['None', 'Some', 'Regular'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDomainSelections(prev => ({ ...prev, [domain.key]: level }))}
                    className={`p-3 rounded-xl text-[14px] font-medium transition-all ${
                      domainSelections[domain.key] === level
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Weekly time budget for health activities
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['< 2 hours', '2-5 hours', '5-10 hours', '10+ hours'].map(budget => (
                <button
                  key={budget}
                  type="button"
                  onClick={() => setTimeBudget(budget)}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    timeBudget === budget
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {budget}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 7: Coaching */}
      {step === 7 && (
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Preferred coaching tone
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Supportive', 'Direct', 'Challenging'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    tone === t
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Check-in cadence
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Daily', 'Every few days', 'Weekly'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCadence(c)}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    cadence === c
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Nudge style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Gentle', 'Persistent', 'Aggressive'].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNudgeStyle(n)}
                  className={`p-3 rounded-xl text-[15px] font-medium transition-all ${
                    nudgeStyle === n
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Commitment level (1-10)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={commitment}
                onChange={e => setCommitment(Number(e.target.value))}
                className="flex-1 h-2 bg-[#E5E5EA] rounded-lg appearance-none cursor-pointer accent-[#007AFF]"
              />
              <span className="text-[22px] font-bold text-black tabular-nums w-8 text-center">{commitment}</span>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              What brought you here today?
            </label>
            <textarea
              value={whyNow}
              onChange={e => setWhyNow(e.target.value)}
              className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none resize-none"
              rows={3}
              placeholder="Share your motivation..."
            />
            <button
              type="button"
              onClick={() => setWhyNow('prefer not to say')}
              className="mt-2 text-[13px] text-[#8E8E93] hover:text-[#007AFF]"
            >
              Prefer not to say
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5EA]">
        {step > 1 ? (
          <button
            onClick={handleBack}
            className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {step !== 3 && (
          <button
            onClick={handleNext}
            disabled={saving}
            className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] disabled:cursor-not-allowed transition-colors ml-auto"
          >
            {saving ? 'Saving…' : step === 7 ? 'Continue' : 'Next'}
          </button>
        )}

        {step === 3 && (
          <button
            onClick={handleNext}
            disabled={saving}
            className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] disabled:cursor-not-allowed transition-colors ml-auto"
          >
            {saving ? 'Saving…' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}

