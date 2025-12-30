'use client'

import { useState, useRef } from 'react'
import {
  MetabolismDiagnosis,
  FamilyHistory,
  MetabolismMedication,
  LabsEntry,
} from '@/lib/onboarding/types'
import { LabAnalysisResponse, ExtractedLabValue, MARKER_DISPLAY_NAMES, LabMarkerKey } from '@/lib/lab-analysis/types'

interface MetabolismCardProps {
  initialData?: {
    diagnoses?: MetabolismDiagnosis[]
    family_history?: FamilyHistory[]
    medications?: MetabolismMedication[]
    labs?: LabsEntry
  }
  onChange: (data: {
    diagnoses?: MetabolismDiagnosis[]
    family_history?: FamilyHistory[]
    medications?: MetabolismMedication[]
    labs?: LabsEntry
  }) => void
}

const DIAGNOSIS_OPTIONS: { value: MetabolismDiagnosis; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'prediabetes', label: 'Prediabetes' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'high_cholesterol', label: 'High cholesterol' },
  { value: 'high_apob', label: 'High ApoB' },
  { value: 'high_ldl', label: 'High LDL' },
  { value: 'fatty_liver', label: 'Fatty liver' },
  { value: 'high_blood_pressure', label: 'High BP' },
]

const FAMILY_OPTIONS: { value: FamilyHistory; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'early_heart_disease', label: 'Early heart disease' },
  { value: 'type2_diabetes', label: 'Type 2 diabetes' },
]

const MEDICATION_OPTIONS: { value: MetabolismMedication; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'statin', label: 'Statin' },
  { value: 'metformin', label: 'Metformin' },
  { value: 'glp1', label: 'GLP-1' },
  { value: 'other', label: 'Other' },
]

type LabInputMode = 'manual' | 'upload' | 'extracted'

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

// Generate year options (current year and previous 3 years)
function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear()
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(String)
}

// Parse YYYY-MM to { month, year }
function parseLabDate(dateStr: string): { month: string; year: string } {
  if (!dateStr || dateStr.length < 7) return { month: '', year: '' }
  const [year, month] = dateStr.split('-')
  return { month: month || '', year: year || '' }
}

// Combine month and year to YYYY-MM
function formatLabDate(month: string, year: string): string {
  if (!month || !year) return ''
  return `${year}-${month}`
}

export default function MetabolismCard({ initialData, onChange }: MetabolismCardProps) {
  const [diagnoses, setDiagnoses] = useState<MetabolismDiagnosis[]>(
    initialData?.diagnoses || []
  )
  const [familyHistory, setFamilyHistory] = useState<FamilyHistory[]>(
    initialData?.family_history || []
  )
  const [medications, setMedications] = useState<MetabolismMedication[]>(
    initialData?.medications || []
  )
  
  const [apob, setApob] = useState<number | ''>(initialData?.labs?.apob_mg_dl || '')
  const [hba1c, setHba1c] = useState<number | ''>(initialData?.labs?.hba1c_percent || '')
  const [hscrp, setHscrp] = useState<number | ''>(initialData?.labs?.hscrp_mg_l || '')
  const [ldl, setLdl] = useState<number | ''>(initialData?.labs?.ldl_mg_dl || '')
  const [triglycerides, setTriglycerides] = useState<number | ''>(initialData?.labs?.triglycerides_mg_dl || '')
  const [fastingGlucose, setFastingGlucose] = useState<number | ''>(initialData?.labs?.fasting_glucose_mg_dl || '')
  
  // Separate month/year for better UX
  const initialDate = parseLabDate(initialData?.labs?.test_date || '')
  const [labMonth, setLabMonth] = useState(initialDate.month)
  const [labYear, setLabYear] = useState(initialDate.year)
  
  // Lab upload state
  const [labInputMode, setLabInputMode] = useState<LabInputMode>(
    initialData?.labs?.upload_id ? 'extracted' : 'manual'
  )
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'analyzing' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extractedValues, setExtractedValues] = useState<ExtractedLabValue[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const emitChange = (updates: Partial<{
    diagnoses: MetabolismDiagnosis[]
    family_history: FamilyHistory[]
    medications: MetabolismMedication[]
    labs: LabsEntry
  }>) => {
    const data: {
      diagnoses?: MetabolismDiagnosis[]
      family_history?: FamilyHistory[]
      medications?: MetabolismMedication[]
      labs?: LabsEntry
    } = {
      diagnoses: updates.diagnoses ?? diagnoses,
      family_history: updates.family_history ?? familyHistory,
      medications: updates.medications ?? medications,
    }

    // Include labs if any values are present
    const hasLabs = (updates.labs?.apob_mg_dl ?? apob) || 
                    (updates.labs?.hba1c_percent ?? hba1c) || 
                    (updates.labs?.hscrp_mg_l ?? hscrp) ||
                    (updates.labs?.ldl_mg_dl ?? ldl) ||
                    (updates.labs?.triglycerides_mg_dl ?? triglycerides) ||
                    (updates.labs?.fasting_glucose_mg_dl ?? fastingGlucose)
    
    if (hasLabs) {
      data.labs = {
        ...(apob ? { apob_mg_dl: Number(apob) } : {}),
        ...(hba1c ? { hba1c_percent: Number(hba1c) } : {}),
        ...(hscrp ? { hscrp_mg_l: Number(hscrp) } : {}),
        ...(ldl ? { ldl_mg_dl: Number(ldl) } : {}),
        ...(triglycerides ? { triglycerides_mg_dl: Number(triglycerides) } : {}),
        ...(fastingGlucose ? { fasting_glucose_mg_dl: Number(fastingGlucose) } : {}),
        ...(labMonth && labYear ? { test_date: formatLabDate(labMonth, labYear) } : {}),
        ...(updates.labs?.upload_id ? { upload_id: updates.labs.upload_id } : {}),
      }
    }

    onChange(data)
  }

  const handleLabUpload = async (file: File) => {
    setUploadError(null)
    setUploadState('uploading')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', 'onboarding')

      setUploadState('analyzing')

      const response = await fetch('/api/uploads/labs/analyze', {
        method: 'POST',
        body: formData,
      })

      const data: LabAnalysisResponse = await response.json()

      if (!data.success) {
        setUploadState('error')
        setUploadError(data.error || 'Failed to analyze lab report')
        return
      }

      // Extract and set values
      const extracted = data.extracted_values || []
      setExtractedValues(extracted)
      setLabInputMode('extracted')
      setUploadState('idle')

      // Update form values from extracted data
      const normalized = data.normalized_values || {}
      if (normalized.apob_mg_dl) setApob(normalized.apob_mg_dl)
      if (normalized.hba1c_percent) setHba1c(normalized.hba1c_percent)
      if (normalized.hscrp_mg_l) setHscrp(normalized.hscrp_mg_l)
      if (normalized.ldl_mg_dl) setLdl(normalized.ldl_mg_dl)
      if (normalized.triglycerides_mg_dl) setTriglycerides(normalized.triglycerides_mg_dl)
      if (normalized.fasting_glucose_mg_dl) setFastingGlucose(normalized.fasting_glucose_mg_dl)
      if (data.lab_info?.test_date) {
        const parsed = parseLabDate(data.lab_info.test_date.substring(0, 7))
        setLabMonth(parsed.month)
        setLabYear(parsed.year)
      }

      // Emit change with upload_id
      emitChange({
        labs: {
          ...(normalized.apob_mg_dl ? { apob_mg_dl: normalized.apob_mg_dl } : {}),
          ...(normalized.hba1c_percent ? { hba1c_percent: normalized.hba1c_percent } : {}),
          ...(normalized.hscrp_mg_l ? { hscrp_mg_l: normalized.hscrp_mg_l } : {}),
          ...(normalized.ldl_mg_dl ? { ldl_mg_dl: normalized.ldl_mg_dl } : {}),
          ...(normalized.triglycerides_mg_dl ? { triglycerides_mg_dl: normalized.triglycerides_mg_dl } : {}),
          ...(normalized.fasting_glucose_mg_dl ? { fasting_glucose_mg_dl: normalized.fasting_glucose_mg_dl } : {}),
          ...(data.lab_info?.test_date ? { test_date: data.lab_info.test_date.substring(0, 7) } : 
              (labMonth && labYear) ? { test_date: formatLabDate(labMonth, labYear) } : {}),
          upload_id: data.upload_id,
        }
      })
    } catch (e) {
      console.error('Lab upload error:', e)
      setUploadState('error')
      setUploadError('Upload failed. Please try again.')
    }
  }

  const getMarkerDisplayName = (key: string): string => {
    return MARKER_DISPLAY_NAMES[key as LabMarkerKey] || key
  }

  const toggleMultiSelect = <T extends string>(
    current: T[],
    value: T,
    noneValue: T,
    setter: (v: T[]) => void,
    emitKey: 'diagnoses' | 'family_history' | 'medications'
  ) => {
    let newValues: T[]
    
    if (value === noneValue) {
      // If selecting "none", clear all others
      newValues = current.includes(noneValue) ? [] : [noneValue]
    } else {
      // If selecting something else, remove "none"
      const withoutNone = current.filter(v => v !== noneValue)
      if (withoutNone.includes(value)) {
        newValues = withoutNone.filter(v => v !== value)
      } else {
        newValues = [...withoutNone, value]
      }
    }
    
    setter(newValues)
    emitChange({ [emitKey]: newValues } as Partial<{
      diagnoses: MetabolismDiagnosis[]
      family_history: FamilyHistory[]
      medications: MetabolismMedication[]
    }>)
  }

  const hasLabValues = apob || hba1c || hscrp || ldl || triglycerides || fastingGlucose

  return (
    <div className="bg-white">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleLabUpload(file)
        }}
        className="hidden"
      />

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Section 1: Lab Results (priority) */}
        {/* Success state - matches BodyPhotoAnalyzer pattern */}
        {labInputMode === 'extracted' && extractedValues.length > 0 ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#34C759]/10 space-y-3">
              {/* Success header */}
              <div className="flex items-center gap-2 text-[15px] font-medium text-[#34C759]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {extractedValues.length} values extracted
              </div>
              
              {/* Extracted values grid */}
              <div className="grid grid-cols-2 gap-2">
                {extractedValues.map((val, idx) => (
                  <div key={idx} className="p-2 bg-white/60 rounded-lg">
                    <p className="text-[11px] text-[#3C3C43]/70">{getMarkerDisplayName(val.marker_key)}</p>
                    <p className="text-[14px] font-semibold text-[#1C1C1E]">{val.value} {val.unit}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtle replace action */}
            <button
              type="button"
              onClick={() => {
                setLabInputMode('upload')
                setExtractedValues([])
                setUploadState('idle')
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[13px] text-[#8E8E93] hover:text-[#3C3C43] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Upload different report
            </button>
          </div>
        ) : (
          <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-[#3C3C43]">
                Recent lab results
              </label>
              <span className="text-[11px] text-[#FF9500] bg-[#FF9500]/10 px-2 py-0.5 rounded font-medium">
                recommended
              </span>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLabInputMode('upload')}
                className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${
                  labInputMode === 'upload'
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-white border border-[#C6C6C8] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Report
              </button>
              <button
                type="button"
                onClick={() => setLabInputMode('manual')}
                className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  labInputMode === 'manual'
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-white border border-[#C6C6C8] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                Enter Manually
              </button>
            </div>

            {/* Upload Mode */}
            {labInputMode === 'upload' && (
              <div className="text-center py-4">
                {uploadState === 'idle' && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-[#C6C6C8] rounded-lg text-[#3C3C43] hover:border-[#FF9500] hover:text-[#FF9500] transition-colors"
                    >
                      <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Take photo or screenshot
                    </button>
                    <p className="text-[11px] text-[#8E8E93] mt-2">
                      Photo or screenshot • Any language
                    </p>
                  </>
                )}
                {(uploadState === 'uploading' || uploadState === 'analyzing') && (
                  <div className="py-4">
                    <div className="w-8 h-8 mx-auto mb-2 border-2 border-[#FF9500] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[13px] text-[#3C3C43]">
                      {uploadState === 'uploading' ? 'Uploading...' : 'Analyzing lab report...'}
                    </p>
                  </div>
                )}
                {uploadState === 'error' && (
                  <div className="py-2">
                    <p className="text-[13px] text-[#FF3B30] mb-2">{uploadError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadState('idle')
                        setUploadError(null)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className="text-[13px] text-[#FF9500] font-medium"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manual Entry */}
            {labInputMode === 'manual' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8E8E93] mb-1">ApoB (mg/dL)</label>
                  <input
                    type="number"
                    value={apob}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setApob(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="90"
                    step="0.1"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8E8E93] mb-1">LDL (mg/dL)</label>
                  <input
                    type="number"
                    value={ldl}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setLdl(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="100"
                    step="1"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8E8E93] mb-1">HbA1c (%)</label>
                  <input
                    type="number"
                    value={hba1c}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setHba1c(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="5.4"
                    step="0.1"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8E8E93] mb-1">Fasting Glucose (mg/dL)</label>
                  <input
                    type="number"
                    value={fastingGlucose}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setFastingGlucose(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="95"
                    step="1"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8E8E93] mb-1">Triglycerides (mg/dL)</label>
                  <input
                    type="number"
                    value={triglycerides}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setTriglycerides(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="100"
                    step="1"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8E8E93] mb-1">hs-CRP (mg/L)</label>
                  <input
                    type="number"
                    value={hscrp}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setHscrp(v)
                    }}
                    onBlur={() => emitChange({})}
                    placeholder="1.0"
                    step="0.1"
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-[#8E8E93] mb-1">Test date</label>
                  <div className="flex gap-2">
                    <select
                      value={labMonth}
                      onChange={e => {
                        setLabMonth(e.target.value)
                        if (e.target.value && labYear) emitChange({})
                      }}
                      className="flex-1 px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238E8E93'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
                    >
                      <option value="">Month</option>
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={labYear}
                      onChange={e => {
                        setLabYear(e.target.value)
                        if (labMonth && e.target.value) emitChange({})
                      }}
                      className="w-24 px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#FF9500] outline-none appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238E8E93'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {!hasLabValues && labInputMode !== 'upload' && (
            <p className="text-[11px] text-[#8E8E93]">
              Lab values significantly improve your Metabolism score accuracy. Without labs, confidence is limited.
            </p>
          )}
          </div>
        )}

        {/* Section 2: Diagnosed Conditions */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Diagnosed conditions
          </label>
          <div className="flex flex-wrap gap-2">
            {DIAGNOSIS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMultiSelect(
                  diagnoses, 
                  opt.value, 
                  'none', 
                  setDiagnoses, 
                  'diagnoses'
                )}
                className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  diagnoses.includes(opt.value)
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Family History */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Family history
          </label>
          <div className="flex flex-wrap gap-2">
            {FAMILY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMultiSelect(
                  familyHistory, 
                  opt.value, 
                  'none', 
                  setFamilyHistory, 
                  'family_history'
                )}
                className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  familyHistory.includes(opt.value)
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Medications */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Current medications
          </label>
          <div className="flex flex-wrap gap-2">
            {MEDICATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMultiSelect(
                  medications, 
                  opt.value, 
                  'none', 
                  setMedications, 
                  'medications'
                )}
                className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  medications.includes(opt.value)
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
