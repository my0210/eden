'use client'

import { useState, useEffect, useCallback } from 'react'
import { MARKER_DISPLAY_NAMES, LabMarkerKey, ExtractedLabValue } from '@/lib/lab-analysis/types'

interface LabUpload {
  id: string
  file_name: string
  file_type: string
  status: string
  confirmed?: boolean
  lab_date: string | null
  lab_provider: string | null
  extracted_values: ExtractedLabValue[] | null
  created_at: string
  processed_at: string | null
}

interface LabUploadsListProps {
  onDelete?: () => void
}

export default function LabUploadsList({ onDelete }: LabUploadsListProps) {
  const [uploads, setUploads] = useState<LabUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch('/api/uploads/labs/list')
      const data = await res.json()
      setUploads(data.uploads || [])
    } catch (e) {
      console.error('Error fetching lab uploads:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUploads()
  }, [fetchUploads])

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      'This will remove: lab file, extracted biomarker values. Your Metabolism score may change.'
    )
    if (!confirmed) return

    setDeleteId(id)
    try {
      const res = await fetch(`/api/uploads/labs/${id}/delete`, { method: 'DELETE' })
      if (res.ok) {
        setUploads(prev => prev.filter(u => u.id !== id))
        onDelete?.()
      }
    } catch (e) {
      console.error('Error deleting lab upload:', e)
    } finally {
      setDeleteId(null)
    }
  }

  const getMarkerDisplayName = (key: string): string => {
    return MARKER_DISPLAY_NAMES[key as LabMarkerKey] || key
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="py-4 text-center text-[13px] text-[#8E8E93]">
        Loading lab uploads...
      </div>
    )
  }

  if (uploads.length === 0) {
    return (
      <div className="py-4 text-center text-[13px] text-[#8E8E93]">
        No lab reports uploaded yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {uploads.map(upload => {
        const isExpanded = expandedId === upload.id
        const markersCount = upload.extracted_values?.length || 0

        return (
          <div
            key={upload.id}
            className="border border-[#E5E5EA] rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F2F2F7]/50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : upload.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF9500]/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#1C1C1E]">
                    {upload.lab_provider || 'Lab Results'}
                  </p>
                  <p className="text-[12px] text-[#8E8E93]">
                    {markersCount} markers • {upload.lab_date || formatDate(upload.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-[11px] font-medium ${
                  upload.confirmed
                    ? 'bg-[#34C759]/10 text-[#34C759]'
                    : upload.status === 'completed'
                    ? 'bg-[#34C759]/10 text-[#34C759]'
                    : upload.status === 'failed'
                    ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
                    : 'bg-[#FF9500]/10 text-[#FF9500]'
                }`}>
                  {upload.confirmed ? 'Applied' : (upload.status === 'completed' ? 'Extracted' : upload.status)}
                </span>
                <svg
                  className={`w-5 h-5 text-[#8E8E93] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-[#E5E5EA] p-4 bg-[#F2F2F7]/30">
                {/* Extracted Values */}
                {upload.extracted_values && upload.extracted_values.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                      Extracted Biomarkers
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {upload.extracted_values.map((val, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-white rounded-lg border border-[#E5E5EA]"
                        >
                          <p className="text-[11px] text-[#8E8E93]">
                            {getMarkerDisplayName(val.marker_key)}
                          </p>
                          <p className="text-[14px] font-semibold text-[#1C1C1E]">
                            {val.value} {val.unit}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Info */}
                <div className="flex items-center justify-between text-[12px] text-[#8E8E93]">
                  <span>
                    {upload.file_name} • {upload.file_type.toUpperCase()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(upload.id)
                    }}
                    disabled={deleteId === upload.id}
                    className="text-[#FF3B30] hover:text-[#FF3B30]/80 font-medium disabled:opacity-50"
                  >
                    {deleteId === upload.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

