'use client'

import { useState, useRef, useCallback } from 'react'
import { LabAnalysisResponse, ExtractedLabValue, MARKER_DISPLAY_NAMES, LabMarkerKey } from '@/lib/lab-analysis/types'

type UploadState = 'empty' | 'uploading' | 'analyzing' | 'rejected' | 'success' | 'error'

interface LabUploadAnalyzerProps {
  onAnalysisComplete?: (result: LabAnalysisResponse) => void
  source?: string
}

export default function LabUploadAnalyzer({
  onAnalysisComplete,
  source = 'data_page',
}: LabUploadAnalyzerProps) {
  const [state, setState] = useState<UploadState>('empty')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LabAnalysisResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null)
    setState('uploading')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source)

      setState('analyzing')

      const response = await fetch('/api/uploads/labs/analyze', {
        method: 'POST',
        body: formData,
      })

      const data: LabAnalysisResponse = await response.json()

      if (!data.success) {
        if (data.validation && !data.validation.is_valid) {
          setState('rejected')
          setError(data.error || 'This doesn\'t appear to be a valid lab report.')
        } else {
          setState('error')
          setError(data.error || 'Analysis failed. Please try again.')
        }
        return
      }

      setState('success')
      setResult(data)
      onAnalysisComplete?.(data)
    } catch (e) {
      console.error('Lab upload error:', e)
      setState('error')
      setError('Upload failed. Please check your connection and try again.')
    }
  }, [source, onAnalysisComplete])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleReset = useCallback(() => {
    setState('empty')
    setError(null)
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const getMarkerDisplayName = (key: string): string => {
    return MARKER_DISPLAY_NAMES[key as LabMarkerKey] || key
  }

  const getFlagColor = (flag?: string): string => {
    switch (flag) {
      case 'high':
      case 'critical':
        return 'text-red-600 bg-red-50'
      case 'low':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-green-600 bg-green-50'
    }
  }

  const getFlagLabel = (flag?: string): string => {
    switch (flag) {
      case 'high':
        return 'High'
      case 'low':
        return 'Low'
      case 'critical':
        return 'Critical'
      default:
        return 'Normal'
    }
  }

  // Empty state
  if (state === 'empty') {
    return (
      <div className="border-2 border-dashed border-[#C6C6C8] rounded-xl p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
        
        <div className="mb-4">
          <div className="w-12 h-12 mx-auto bg-[#FF9500]/10 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-1">
            Upload Lab Results
          </h3>
          <p className="text-[13px] text-[#8E8E93]">
            Photo or screenshot of your lab report
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-4 py-3 bg-[#FF9500] text-white font-semibold rounded-xl text-[15px] hover:bg-[#FF9500]/90 transition-colors"
        >
          Choose File
        </button>

        <p className="mt-3 text-[11px] text-[#8E8E93]">
          We extract HbA1c, ApoB, LDL, and more.
          Supports German, English, and other languages.
        </p>
      </div>
    )
  }

  // Uploading/Analyzing state
  if (state === 'uploading' || state === 'analyzing') {
    return (
      <div className="border border-[#E5E5EA] rounded-xl p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 relative">
          <div className="absolute inset-0 border-4 border-[#FF9500]/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-[#FF9500] rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-[15px] font-medium text-[#1C1C1E]">
          {state === 'uploading' ? 'Uploading...' : 'Analyzing lab report...'}
        </p>
        <p className="text-[13px] text-[#8E8E93] mt-1">
          {state === 'analyzing' ? 'Extracting biomarker values' : 'This may take 15-20 seconds'}
        </p>
      </div>
    )
  }

  // Error or Rejected state
  if (state === 'error' || state === 'rejected') {
    return (
      <div className="border border-[#FF3B30]/30 bg-[#FF3B30]/5 rounded-xl p-6 text-center">
        <div className="w-12 h-12 mx-auto bg-[#FF3B30]/10 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-[#FF3B30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-[15px] font-medium text-[#1C1C1E] mb-2">
          {state === 'rejected' ? 'Not a valid lab report' : 'Something went wrong'}
        </p>
        <p className="text-[13px] text-[#8E8E93] mb-4">{error}</p>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-[#FF9500] text-white font-medium rounded-lg text-[13px]"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Success state
  if (state === 'success' && result) {
    const extractedValues = result.extracted_values || []
    
    return (
      <div className="border border-[#34C759]/30 bg-[#34C759]/5 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#34C759]/10 border-b border-[#34C759]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#34C759] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1C1C1E]">
                {extractedValues.length} biomarkers extracted
              </p>
              {result.lab_info?.lab_provider && (
                <p className="text-[13px] text-[#8E8E93]">
                  {result.lab_info.lab_provider}
                  {result.lab_info.test_date && ` • ${result.lab_info.test_date}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Extracted Values */}
        <div className="p-4">
          <div className="space-y-2">
            {extractedValues.map((val: ExtractedLabValue, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 border-b border-[#E5E5EA] last:border-0"
              >
                <div>
                  <p className="text-[14px] font-medium text-[#1C1C1E]">
                    {getMarkerDisplayName(val.marker_key)}
                  </p>
                  {val.reference_range && (
                    <p className="text-[11px] text-[#8E8E93]">
                      Ref: {val.reference_range}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-[#1C1C1E]">
                    {val.value} {val.unit}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getFlagColor(val.flag)}`}>
                    {getFlagLabel(val.flag)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleReset}
            className="mt-4 w-full px-4 py-2 border border-[#C6C6C8] text-[#3C3C43] font-medium rounded-lg text-[13px] hover:bg-[#F2F2F7] transition-colors"
          >
            Upload Another Report
          </button>
        </div>
      </div>
    )
  }

  return null
}

