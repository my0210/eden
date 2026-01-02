'use client'

import { useState, useCallback } from 'react'
import LabUploadAnalyzer from '@/components/uploads/LabUploadAnalyzer'
import LabUploadsList from '@/components/uploads/LabUploadsList'

export default function LabSection() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleUploadComplete = useCallback(() => {
    // Refresh the list when a new upload is completed
    setRefreshKey(prev => prev + 1)
  }, [])

  return (
    <section>
      <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
        Lab Reports
      </h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] overflow-hidden">
        {/* Upload */}
        <div className="p-4 border-b border-[#E5E5EA]">
          <LabUploadAnalyzer 
            source="data_page" 
            onAnalysisComplete={handleUploadComplete}
          />
        </div>

        {/* Previous Uploads */}
        <div className="p-4">
          <h3 className="text-[13px] font-medium text-[#3C3C43] mb-3">
            Previous Uploads
          </h3>
          <LabUploadsList key={refreshKey} onDelete={handleUploadComplete} />
        </div>
      </div>

      {/* Eden Labs Coming Soon */}
      <div className="mt-3 bg-white rounded-xl border border-[#E5E5EA] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E5E5EA] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-[#8E8E93]">Eden Labs</h3>
            <p className="text-[14px] text-[#AEAEB2]">Coming soon — order lab tests directly through Eden</p>
          </div>
        </div>
      </div>
    </section>
  )
}

