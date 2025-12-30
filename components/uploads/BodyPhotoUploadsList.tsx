'use client'

import { useEffect, useState } from 'react'

type UploadStatus = 'pending' | 'completed' | 'failed'

interface PhotoUpload {
  id: string
  status: UploadStatus
  storage_path: string | null
  created_at: string
  processed_at: string | null
  metadata_json: {
    validation?: {
      valid: boolean
      rejection_reason?: string
      user_message?: string
    }
    analysis?: {
      body_fat_estimate?: { range_low: number; range_high: number } | { unable_to_estimate: true; reason: string }
      midsection_adiposity?: { level: string } | { unable_to_estimate: true; reason: string }
    }
    derived?: {
      lean_mass_estimate_kg?: { range_low: number; range_high: number }
    }
  } | null
}

interface Props {
  onDelete?: () => void
}

export default function BodyPhotoUploadsList({ onDelete }: Props) {
  const [uploads, setUploads] = useState<PhotoUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadUploads = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/uploads/photos/list')
      if (!res.ok) {
        throw new Error('Failed to load uploads')
      }
      const data = await res.json()
      setUploads(data.uploads || [])
    } catch (err) {
      console.error(err)
      setError('Failed to load uploads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUploads()
  }, [])

  const handleDelete = async (uploadId: string) => {
    setDeletingId(uploadId)
    setError(null)

    try {
      const res = await fetch(`/api/uploads/photos/${uploadId}/delete`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete upload')
      }

      // Reload uploads
      await loadUploads()

      // Trigger scorecard refresh
      window.dispatchEvent(new Event('scorecard-updated'))

      // Call parent callback
      if (onDelete) {
        onDelete()
      }

      setShowConfirm(null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to delete upload')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const statusBadge = (upload: PhotoUpload) => {
    const status = upload.status
    const color =
      status === 'completed' ? 'bg-[#34C759]/10 text-[#34C759]' :
      status === 'failed' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
      'bg-[#FF9500]/10 text-[#FF9500]'
    const label =
      status === 'completed' ? 'Analyzed' :
      status === 'failed' ? 'Failed' :
      'Pending'
    return (
      <span className={`text-[13px] font-medium px-2.5 py-1 rounded-full ${color}`}>
        {label}
      </span>
    )
  }

  const isUnableToEstimate = (val: unknown): boolean => {
    return typeof val === 'object' && val !== null && 'unable_to_estimate' in val
  }

  const getAnalysisMetrics = (upload: PhotoUpload) => {
    const analysis = upload.metadata_json?.analysis
    const derived = upload.metadata_json?.derived
    if (!analysis && !derived) return null
    
    const metrics = []
    
    // Body fat from analysis
    if (analysis?.body_fat_estimate && !isUnableToEstimate(analysis.body_fat_estimate)) {
      const bf = analysis.body_fat_estimate as { range_low: number; range_high: number }
      metrics.push({
        label: 'Body fat',
        value: `${bf.range_low}-${bf.range_high}%`,
        color: 'bg-[#007AFF]/10 text-[#007AFF]'
      })
    }
    
    // Lean mass from derived
    if (derived?.lean_mass_estimate_kg) {
      metrics.push({
        label: 'Lean mass',
        value: `${derived.lean_mass_estimate_kg.range_low}-${derived.lean_mass_estimate_kg.range_high} kg`,
        color: 'bg-[#34C759]/10 text-[#34C759]'
      })
    }
    
    // Midsection from analysis
    if (analysis?.midsection_adiposity && !isUnableToEstimate(analysis.midsection_adiposity)) {
      const mid = analysis.midsection_adiposity as { level: string }
      metrics.push({
        label: 'Midsection',
        value: mid.level,
        color: 'bg-[#FF9500]/10 text-[#FF9500]'
      })
    }
    
    return metrics.length > 0 ? metrics : null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="text-[15px] text-[#8E8E93]">Loading photos...</div>
      </div>
    )
  }

  if (uploads.length === 0) {
    return null // Don't show empty state
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[20px] font-semibold text-black">Body Photo Uploads</h2>
      
      {error && (
        <div className="p-3 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {uploads.map((upload) => {
          const metrics = getAnalysisMetrics(upload)
          
          return (
            <div
              key={upload.id}
              className="bg-white rounded-xl shadow-sm p-4 border border-[#E5E5EA]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#5856D6]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#5856D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-[15px] font-medium text-[#3C3C43]">
                      Body composition photo
                    </span>
                    {statusBadge(upload)}
                  </div>
                  
                  <div className="text-[13px] text-[#8E8E93] space-y-1">
                    <div>Uploaded: {formatDate(upload.created_at)}</div>
                    {upload.processed_at && (
                      <div className="text-[#34C759]">Analyzed: {formatDate(upload.processed_at)}</div>
                    )}
                  </div>
                  
                  {/* Show extracted metrics */}
                  {metrics && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {metrics.map((m, i) => (
                        <span key={i} className={`text-[12px] px-2 py-1 rounded-full ${m.color}`}>
                          {m.label}: {m.value}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Show error if failed */}
                  {upload.status === 'failed' && upload.metadata_json?.validation?.user_message && (
                    <div className="text-[13px] text-[#FF3B30] mt-2">
                      {upload.metadata_json.validation.user_message}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowConfirm(upload.id)}
                  disabled={deletingId === upload.id}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === upload.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-[20px] font-semibold text-black mb-2">
              Delete body photo?
            </h3>
            <p className="text-[15px] text-[#3C3C43] mb-6 leading-relaxed">
              This will remove the photo and any body composition data extracted from it. 
              Your Prime Scorecard may change. This can&apos;t be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-3 text-[17px] font-medium text-[#007AFF] bg-[#F2F2F7] rounded-xl hover:bg-[#E5E5EA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showConfirm)}
                disabled={deletingId === showConfirm}
                className="flex-1 px-4 py-3 text-[17px] font-medium text-white bg-[#FF3B30] rounded-xl hover:bg-[#D32F2F] active:bg-[#C62828] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === showConfirm ? 'Deleting...' : 'Delete photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

