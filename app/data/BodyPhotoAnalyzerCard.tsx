'use client'

import { useState } from 'react'
import UploadCard from '@/components/uploads/UploadCard'
import BodyPhotoAnalyzer from '@/components/uploads/BodyPhotoAnalyzer'
import { MidsectionAdiposityLevel } from '@/lib/onboarding/types'

export default function BodyPhotoAnalyzerCard() {
  const [analysisResult, setAnalysisResult] = useState<{
    uploadId: string
    bodyFatRange?: { low: number; high: number }
    midsectionAdiposityLevel?: MidsectionAdiposityLevel
    leanMassRange?: { low: number; high: number }
  } | null>(null)

  const handleAnalysisComplete = (result: {
    uploadId: string
    bodyFatRange?: { low: number; high: number }
    midsectionAdiposityLevel?: MidsectionAdiposityLevel
    leanMassRange?: { low: number; high: number }
    estimatedWaistToHeight?: number
  }) => {
    setAnalysisResult(result)
  }

  return (
    <UploadCard
      title="Body Photo"
      subtitle="Analyze body composition with AI"
      icon={
        <svg className="w-6 h-6 text-[#5856D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      footer={
        analysisResult && (
          <div className="flex flex-wrap gap-2">
            {analysisResult.bodyFatRange && (
              <span className="text-[12px] px-2 py-1 bg-[#007AFF]/10 text-[#007AFF] rounded-full">
                Body fat: {analysisResult.bodyFatRange.low}-{analysisResult.bodyFatRange.high}%
              </span>
            )}
            {analysisResult.leanMassRange && (
              <span className="text-[12px] px-2 py-1 bg-[#34C759]/10 text-[#34C759] rounded-full">
                Lean mass: {analysisResult.leanMassRange.low}-{analysisResult.leanMassRange.high} kg
              </span>
            )}
            {analysisResult.midsectionAdiposityLevel && (
              <span className="text-[12px] px-2 py-1 bg-[#FF9500]/10 text-[#FF9500] rounded-full">
                Midsection: {analysisResult.midsectionAdiposityLevel}
              </span>
            )}
          </div>
        )
      }
    >
      <BodyPhotoAnalyzer
        source="data_page"
        onAnalysisComplete={handleAnalysisComplete}
      />
    </UploadCard>
  )
}

