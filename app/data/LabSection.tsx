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
        Lab Results
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
    </section>
  )
}

