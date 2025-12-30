'use client'

import { useState } from 'react'
import { 
  PushupCapability, 
  PhotoAnalysisResult, 
  MidsectionAdiposityLevel,
  LimitationSeverity,
  LimitationArea,
  LimitationDuration,
  StiffnessFrequency,
  StructuralIntegrityEntry,
} from '@/lib/onboarding/types'
import BodyPhotoAnalyzer from '@/components/uploads/BodyPhotoAnalyzer'

interface FrameCardProps {
  initialData?: {
    pushup_capability?: PushupCapability
    structural_integrity?: StructuralIntegrityEntry
    waist_cm?: number
    waist_measured_correctly?: boolean
    photo_analysis?: PhotoAnalysisResult
  }
  appleHealthData?: {
    weight?: number
    bodyMass?: number
  }
  onChange: (data: {
    pushup_capability?: PushupCapability
    structural_integrity?: StructuralIntegrityEntry
    waist_cm?: number
    waist_measured_correctly?: boolean
    photo_analysis?: PhotoAnalysisResult
  }) => void
  userWeightKg?: number
}

const PUSHUP_OPTIONS: { value: PushupCapability; label: string }[] = [
  { value: '0-5', label: '0-5' },
  { value: '6-15', label: '6-15' },
  { value: '16-30', label: '16-30' },
  { value: '31+', label: '31+' },
  { value: 'not_possible', label: 'Can\'t do' },
]

const SEVERITY_OPTIONS: { value: LimitationSeverity; label: string; desc: string }[] = [
  { value: 'none', label: 'No limitations', desc: '' },
  { value: 'mild', label: 'Mild', desc: 'I can train normally' },
  { value: 'moderate', label: 'Moderate', desc: 'I avoid some movements' },
  { value: 'severe', label: 'Severe', desc: 'Daily pain or training is hard' },
]

const AREA_OPTIONS: { value: LimitationArea; label: string }[] = [
  { value: 'back_low', label: 'Lower back' },
  { value: 'knee', label: 'Knee' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'neck_upper', label: 'Neck / upper back' },
  { value: 'hip', label: 'Hip' },
  { value: 'ankle_foot', label: 'Ankle / foot' },
  { value: 'wrist_elbow', label: 'Wrist / elbow' },
  { value: 'other', label: 'Other' },
]

const DURATION_OPTIONS: { value: LimitationDuration; label: string }[] = [
  { value: 'new_2w', label: 'New (≤2 weeks)' },
  { value: 'recent_6w', label: 'Recent (2-6 weeks)' },
  { value: 'ongoing_6plus', label: 'Ongoing (6+ weeks)' },
  { value: 'intermittent', label: 'Comes and goes' },
]

const STIFFNESS_OPTIONS: { value: StiffnessFrequency; label: string }[] = [
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
]

export default function FrameCard({ initialData, appleHealthData, onChange, userWeightKg }: FrameCardProps) {
  const [pushupCapability, setPushupCapability] = useState<PushupCapability | undefined>(
    initialData?.pushup_capability
  )
  
  // Structural Integrity state
  const [siSeverity, setSiSeverity] = useState<LimitationSeverity | undefined>(
    initialData?.structural_integrity?.severity
  )
  const [siAreas, setSiAreas] = useState<LimitationArea[]>(
    initialData?.structural_integrity?.areas || []
  )
  const [siDuration, setSiDuration] = useState<LimitationDuration | undefined>(
    initialData?.structural_integrity?.duration
  )
  const [siStiffness, setSiStiffness] = useState<StiffnessFrequency | undefined>(
    initialData?.structural_integrity?.stiffness
  )
  
  const [waistCm, setWaistCm] = useState<number | ''>(initialData?.waist_cm || '')
  const [waistMeasuredCorrectly, setWaistMeasuredCorrectly] = useState(
    initialData?.waist_measured_correctly || false
  )
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisResult | undefined>(
    initialData?.photo_analysis
  )

  const emitChange = (updates: Partial<{
    pushup_capability: PushupCapability
    structural_integrity: StructuralIntegrityEntry
    waist_cm: number
    waist_measured_correctly: boolean
    photo_analysis: PhotoAnalysisResult
  }>) => {
    const data: {
      pushup_capability?: PushupCapability
      structural_integrity?: StructuralIntegrityEntry
      waist_cm?: number
      waist_measured_correctly?: boolean
      photo_analysis?: PhotoAnalysisResult
    } = {
      pushup_capability: updates.pushup_capability ?? pushupCapability,
    }

    // Build structural integrity entry
    const severity = updates.structural_integrity?.severity ?? siSeverity
    if (severity) {
      data.structural_integrity = {
        severity,
        ...(severity !== 'none' && siAreas.length > 0 ? { areas: updates.structural_integrity?.areas ?? siAreas } : {}),
        ...(severity !== 'none' && siDuration ? { duration: updates.structural_integrity?.duration ?? siDuration } : {}),
        ...(siStiffness ? { stiffness: updates.structural_integrity?.stiffness ?? siStiffness } : {}),
      }
    }

    const waist = updates.waist_cm ?? waistCm
    if (waist) {
      data.waist_cm = Number(waist)
      data.waist_measured_correctly = updates.waist_measured_correctly ?? waistMeasuredCorrectly
    }

    const photo = updates.photo_analysis ?? photoAnalysis
    if (photo) {
      data.photo_analysis = photo
    }

    onChange(data)
  }

  const handlePhotoAnalysisComplete = (result: {
    uploadId: string
    bodyFatRange?: { low: number; high: number }
    midsectionAdiposityLevel?: MidsectionAdiposityLevel
    leanMassRange?: { low: number; high: number }
    estimatedWaistToHeight?: number
  }) => {
    const photoResult: PhotoAnalysisResult = {
      upload_id: result.uploadId,
      body_fat_range: result.bodyFatRange,
      midsection_adiposity: result.midsectionAdiposityLevel,
      lean_mass_range_kg: result.leanMassRange,
      analyzed_at: new Date().toISOString(),
    }
    setPhotoAnalysis(photoResult)
    emitChange({ photo_analysis: photoResult })
  }

  const handlePushupChange = (value: PushupCapability) => {
    setPushupCapability(value)
    emitChange({ pushup_capability: value })
  }

  const handleSeverityChange = (value: LimitationSeverity) => {
    setSiSeverity(value)
    // Clear conditional fields if "none"
    if (value === 'none') {
      setSiAreas([])
      setSiDuration(undefined)
    }
    emitChange({ structural_integrity: { severity: value, areas: value === 'none' ? [] : siAreas, duration: value === 'none' ? undefined : siDuration, stiffness: siStiffness } })
  }

  const handleAreaToggle = (area: LimitationArea) => {
    let newAreas: LimitationArea[]
    if (siAreas.includes(area)) {
      newAreas = siAreas.filter(a => a !== area)
    } else {
      // Max 2 areas
      if (siAreas.length >= 2) {
        newAreas = [siAreas[1], area] // Remove oldest, add new
      } else {
        newAreas = [...siAreas, area]
      }
    }
    setSiAreas(newAreas)
    emitChange({ structural_integrity: { severity: siSeverity!, areas: newAreas, duration: siDuration, stiffness: siStiffness } })
  }

  const handleDurationChange = (value: LimitationDuration) => {
    setSiDuration(value)
    emitChange({ structural_integrity: { severity: siSeverity!, areas: siAreas, duration: value, stiffness: siStiffness } })
  }

  const handleStiffnessChange = (value: StiffnessFrequency) => {
    setSiStiffness(value)
    emitChange({ structural_integrity: { severity: siSeverity || 'none', areas: siAreas, duration: siDuration, stiffness: value } })
  }

  const showConditionalSI = siSeverity && siSeverity !== 'none'

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
      <div className="p-4 space-y-6">
        {/* Section 1: Strength Proxy */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            How many push-ups can you do in a row?
          </label>
          <div className="flex flex-wrap gap-2">
            {PUSHUP_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePushupChange(opt.value)}
                className={`px-4 py-2.5 rounded-xl text-[15px] font-medium transition-all ${
                  pushupCapability === opt.value
                    ? 'bg-[#5856D6] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Structural Integrity */}
        <div className="space-y-4">
          {/* SI1: Severity */}
          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Pain or limitation that affects training?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSeverityChange(opt.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    siSeverity === opt.value
                      ? 'bg-[#5856D6] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  <span className="text-[14px] font-medium block">{opt.label}</span>
                  {opt.desc && (
                    <span className={`text-[11px] ${
                      siSeverity === opt.value ? 'text-white/70' : 'text-[#8E8E93]'
                    }`}>
                      {opt.desc}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* SI2 & SI3: Conditional on severity */}
          {showConditionalSI && (
            <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-4">
              {/* SI2: Location */}
              <div>
                <label className="block text-[12px] font-medium text-[#3C3C43] mb-2">
                  Where is it? <span className="text-[#8E8E93] font-normal">(select up to 2)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {AREA_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleAreaToggle(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                        siAreas.includes(opt.value)
                          ? 'bg-[#5856D6] text-white'
                          : 'bg-white text-[#3C3C43] border border-[#C6C6C8] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SI3: Duration */}
              <div>
                <label className="block text-[12px] font-medium text-[#3C3C43] mb-2">
                  How long has it been an issue?
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleDurationChange(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                        siDuration === opt.value
                          ? 'bg-[#5856D6] text-white'
                          : 'bg-white text-[#3C3C43] border border-[#C6C6C8] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SI4: Stiffness (optional, universal) */}
          <div>
            <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              How often do you feel stiff when you start moving?
            </label>
            <div className="flex gap-2">
              {STIFFNESS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStiffnessChange(opt.value)}
                  className={`flex-1 p-2.5 rounded-xl text-[14px] font-medium transition-all ${
                    siStiffness === opt.value
                      ? 'bg-[#5856D6] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Waist Measurement */}
        <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-[#3C3C43]">
              Waist circumference
            </label>
            <span className="text-[11px] text-[#8E8E93] bg-white px-2 py-0.5 rounded">
              optional
            </span>
          </div>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              value={waistCm}
              onChange={e => {
                const v = e.target.value ? Number(e.target.value) : ''
                setWaistCm(v)
              }}
              onBlur={() => emitChange({})}
              placeholder="85"
              className="w-24 px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#5856D6] outline-none"
            />
            <span className="text-[15px] text-[#8E8E93]">cm</span>
            <label className="flex items-center gap-2 text-[13px] text-[#3C3C43] ml-auto">
              <input
                type="checkbox"
                checked={waistMeasuredCorrectly}
                onChange={e => {
                  setWaistMeasuredCorrectly(e.target.checked)
                  emitChange({ waist_measured_correctly: e.target.checked })
                }}
                className="w-4 h-4 rounded border-[#C6C6C8] text-[#5856D6] focus:ring-[#5856D6]"
              />
              At navel, relaxed
            </label>
          </div>
          <p className="text-[11px] text-[#8E8E93]">
            Measure at navel level while standing relaxed, not sucking in.
          </p>
        </div>

        {/* Section 4: Body Photo Analysis */}
        <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-[#3C3C43]">
              Body photo analysis
            </label>
            <span className="text-[11px] text-[#8E8E93] bg-white px-2 py-0.5 rounded">
              optional · improves accuracy
            </span>
          </div>
          
          {photoAnalysis ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[14px] font-medium text-[#34C759]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Photo analyzed
              </div>
              <div className="flex flex-wrap gap-2">
                {photoAnalysis.body_fat_range && (
                  <span className="text-[12px] px-2 py-1 bg-white text-[#5856D6] rounded-full border border-[#5856D6]/20">
                    Body fat: {photoAnalysis.body_fat_range.low}-{photoAnalysis.body_fat_range.high}%
                  </span>
                )}
                {photoAnalysis.lean_mass_range_kg && (
                  <span className="text-[12px] px-2 py-1 bg-white text-[#34C759] rounded-full border border-[#34C759]/20">
                    Lean mass: {photoAnalysis.lean_mass_range_kg.low.toFixed(1)}-{photoAnalysis.lean_mass_range_kg.high.toFixed(1)} kg
                  </span>
                )}
                {photoAnalysis.midsection_adiposity && !waistCm && (
                  <span className="text-[12px] px-2 py-1 bg-white text-[#FF9500] rounded-full border border-[#FF9500]/20">
                    Midsection: {photoAnalysis.midsection_adiposity}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPhotoAnalysis(undefined)}
                className="text-[13px] text-[#8E8E93] hover:text-[#3C3C43] underline"
              >
                Upload new photo
              </button>
            </div>
          ) : (
            <BodyPhotoAnalyzer
              source="onboarding"
              weightKg={userWeightKg || appleHealthData?.weight}
              hasMeasuredWaist={!!waistCm}
              onAnalysisComplete={handlePhotoAnalysisComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}
