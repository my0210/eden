'use client'

import { useState, useRef } from 'react'
import {
  PhotoAnalysisResponse,
  BodyPhotoAnalysis,
  isUnableToEstimate,
  MIDSECTION_TO_WHR,
  MidsectionAdiposityLevel,
} from '@/lib/photo-analysis/types'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp']

type AnalyzerState = 'empty' | 'uploading' | 'analyzing' | 'rejected' | 'success' | 'error'

interface Props {
  /** Source identifier (onboarding, data_page) */
  source?: string
  /** User's weight in kg (for lean mass calculation) */
  weightKg?: number
  /** Callback when analysis completes successfully */
  onAnalysisComplete?: (result: {
    uploadId: string
    bodyFatRange?: { low: number; high: number }
    midsectionAdiposityLevel?: MidsectionAdiposityLevel
    leanMassRange?: { low: number; high: number }
    estimatedWaistToHeight?: number
  }) => void
  /** Whether user has provided a measured waist */
  hasMeasuredWaist?: boolean
}

export default function BodyPhotoAnalyzer({
  source = 'onboarding',
  weightKg,
  onAnalysisComplete,
  hasMeasuredWaist = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<AnalyzerState>('empty')
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<BodyPhotoAnalysis | null>(null)
  const [derived, setDerived] = useState<{ lean_mass_estimate_kg?: { range_low: number; range_high: number } } | null>(null)
  const [privacyConsent, setPrivacyConsent] = useState(false)

  const handleFileSelect = () => {
    if (!privacyConsent) {
      setError('Please accept the privacy notice before uploading.')
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image.')
      setState('error')
      return
    }

    // Reset state
    setError(null)
    setAnalysis(null)
    setDerived(null)
    setState('uploading')

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source)
      if (weightKg) {
        formData.append('weight_kg', weightKg.toString())
      }

      setState('analyzing')

      // Upload and analyze
      const res = await fetch('/api/uploads/photos/analyze', {
        method: 'POST',
        body: formData,
      })

      const result: PhotoAnalysisResponse = await res.json()

      if (!result.success) {
        if (result.error === 'validation_failed') {
          setState('rejected')
        } else {
          setState('error')
        }
        setError(result.user_message)
        return
      }

      // Success
      setState('success')
      setAnalysis(result.analysis)
      setDerived(result.derived || null)

      // Notify parent
      if (onAnalysisComplete) {
        const bodyFatEst = result.analysis.body_fat_estimate
        const midsectionEst = result.analysis.midsection_adiposity

        onAnalysisComplete({
          uploadId: result.upload_id,
          bodyFatRange: bodyFatEst && !isUnableToEstimate(bodyFatEst)
            ? { low: bodyFatEst.range_low, high: bodyFatEst.range_high }
            : undefined,
          midsectionAdiposityLevel: midsectionEst && !isUnableToEstimate(midsectionEst)
            ? midsectionEst.level
            : undefined,
          leanMassRange: result.derived?.lean_mass_estimate_kg,
          estimatedWaistToHeight: midsectionEst && !isUnableToEstimate(midsectionEst) && !hasMeasuredWaist
            ? MIDSECTION_TO_WHR[midsectionEst.level]
            : undefined,
        })
      }
    } catch (err) {
      console.error('Photo analysis error:', err)
      setState('error')
      setError('Something went wrong. Please try again.')
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRetry = () => {
    setState('empty')
    setError(null)
    setAnalysis(null)
    setDerived(null)
  }

  // Render body fat result
  const renderBodyFatResult = () => {
    if (!analysis?.body_fat_estimate) return null
    
    if (isUnableToEstimate(analysis.body_fat_estimate)) {
      return (
        <div className="text-[13px] text-[#8E8E93]">
          Body fat: Not detected
        </div>
      )
    }

    const { range_low, range_high } = analysis.body_fat_estimate
    return (
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-medium text-[#3C3C43]">
          Body fat: {range_low}-{range_high}%
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]">
          Photo Estimate
        </span>
      </div>
    )
  }

  // Render lean mass result
  const renderLeanMassResult = () => {
    if (!derived?.lean_mass_estimate_kg) return null

    const { range_low, range_high } = derived.lean_mass_estimate_kg
    return (
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-medium text-[#3C3C43]">
          Lean mass: {range_low}-{range_high} kg
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759]">
          Derived
        </span>
      </div>
    )
  }

  // Render waist-to-height result (only if no measured waist)
  const renderWaistResult = () => {
    if (hasMeasuredWaist) return null
    if (!analysis?.midsection_adiposity) return null
    
    if (isUnableToEstimate(analysis.midsection_adiposity)) {
      return (
        <div className="text-[13px] text-[#8E8E93]">
          Waist ratio: Not detected
        </div>
      )
    }

    const level = analysis.midsection_adiposity.level
    const ratio = MIDSECTION_TO_WHR[level]
    return (
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-medium text-[#3C3C43]">
          Waist ratio: ~{ratio.toFixed(2)}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FF9500]/10 text-[#FF9500]">
          Photo Estimate
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
        capture="environment"
      />

      {/* Privacy consent */}
      {state === 'empty' && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => setPrivacyConsent(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-[#C7C7CC] text-[#007AFF] focus:ring-[#007AFF]"
          />
          <span className="text-[13px] text-[#8E8E93]">
            Your photo will be analyzed by AI to estimate body composition metrics. 
            The photo is stored securely and only you can access it.
          </span>
        </label>
      )}

      {/* Upload button / States */}
      {state === 'empty' && (
        <button
          onClick={handleFileSelect}
          disabled={!privacyConsent}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[15px] font-medium text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Add Body Photo
        </button>
      )}

      {state === 'uploading' && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 text-[15px] text-[#8E8E93] bg-[#F2F2F7] rounded-xl">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Uploading...
        </div>
      )}

      {state === 'analyzing' && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-[15px] text-[#8E8E93] bg-[#F2F2F7] rounded-xl">
          <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Analyzing your photo...</span>
          <span className="text-[13px]">This may take 5-10 seconds</span>
        </div>
      )}

      {state === 'rejected' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[#FF9500]/10 text-[#FF9500] text-[15px]">
            {error}
          </div>
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[15px] font-medium text-[#007AFF] bg-[#007AFF]/10 rounded-xl hover:bg-[#007AFF]/20 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
            {error || 'Something went wrong. Please try again.'}
          </div>
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[15px] font-medium text-[#007AFF] bg-[#007AFF]/10 rounded-xl hover:bg-[#007AFF]/20 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {state === 'success' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[#34C759]/10 space-y-2">
            <div className="flex items-center gap-2 text-[15px] font-medium text-[#34C759]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Photo analyzed
            </div>
            
            <div className="space-y-1.5 pt-1">
              {renderBodyFatResult()}
              {renderLeanMassResult()}
              {renderWaistResult()}
            </div>
          </div>

          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[13px] text-[#8E8E93] hover:text-[#3C3C43] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Replace Photo
          </button>
        </div>
      )}
    </div>
  )
}

