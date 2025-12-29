'use client'

import { useState } from 'react'
import {
  MetabolismDiagnosis,
  FamilyHistory,
  MetabolismMedication,
  LabsEntry,
} from '@/lib/onboarding/types'

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
  { value: 'high_blood_pressure', label: 'High blood pressure' },
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
  { value: 'glp1', label: 'GLP-1 (Ozempic, etc.)' },
  { value: 'other', label: 'Other' },
]

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
  
  const [showLabsInput, setShowLabsInput] = useState(!!initialData?.labs)
  const [apob, setApob] = useState<number | ''>(initialData?.labs?.apob_mg_dl || '')
  const [hba1c, setHba1c] = useState<number | ''>(initialData?.labs?.hba1c_percent || '')
  const [hscrp, setHscrp] = useState<number | ''>(initialData?.labs?.hscrp_mg_l || '')
  const [labDate, setLabDate] = useState(initialData?.labs?.test_date || '')

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
                    (updates.labs?.hscrp_mg_l ?? hscrp)
    
    if (hasLabs) {
      data.labs = {
        ...(apob ? { apob_mg_dl: Number(apob) } : {}),
        ...(hba1c ? { hba1c_percent: Number(hba1c) } : {}),
        ...(hscrp ? { hscrp_mg_l: Number(hscrp) } : {}),
        ...(labDate ? { test_date: labDate } : {}),
      }
    }

    onChange(data)
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

  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#FF9500]/10 to-[#FF9500]/5 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF9500] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-black">Metabolism</h3>
            <p className="text-[13px] text-[#8E8E93]">Metabolic health & biomarkers</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Add labs (primary value path) */}
        <div>
          <button
            type="button"
            onClick={() => setShowLabsInput(!showLabsInput)}
            className="flex items-center gap-2 text-[15px] text-[#007AFF] font-medium"
          >
            <span>{showLabsInput ? '−' : '+'}</span>
            Add recent lab results (recommended)
          </button>

          {showLabsInput && (
            <div className="mt-3 p-4 bg-[#F2F2F7] rounded-xl space-y-3">
              <p className="text-[12px] text-[#8E8E93] mb-2">
                Adding lab values significantly improves your Metabolism score accuracy
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">ApoB (mg/dL)</label>
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
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">HbA1c (%)</label>
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
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">hs-CRP (mg/L)</label>
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
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[#8E8E93] mb-1">Test date</label>
                  <input
                    type="month"
                    value={labDate}
                    onChange={e => {
                      setLabDate(e.target.value)
                      emitChange({})
                    }}
                    className="w-full px-3 py-2 text-[15px] text-black bg-white border border-[#C6C6C8] rounded-lg focus:border-[#007AFF] outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Check: Diagnoses */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Diagnosed conditions (select all that apply)
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
                className={`px-3 py-2 rounded-xl text-[14px] font-medium transition-all ${
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

        {/* Quick Check: Family History */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Family history (select all that apply)
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
                className={`px-3 py-2 rounded-xl text-[14px] font-medium transition-all ${
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

        {/* Context: Medications */}
        <div>
          <label className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
            Current medications (select all that apply)
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
                className={`px-3 py-2 rounded-xl text-[14px] font-medium transition-all ${
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

        {/* Note about confidence cap */}
        {!showLabsInput && (
          <div className="p-3 bg-[#FF9500]/10 rounded-xl">
            <p className="text-[13px] text-[#C85D00]">
              💡 Without lab values, Metabolism confidence will be limited. Add recent labs for better accuracy.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

