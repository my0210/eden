'use client'

import { useEffect, useRef, useState } from 'react'

type UploadStatus = 'pending' | 'completed' | 'failed'

interface PhotoUpload {
  id: string
  status: UploadStatus
  file_path: string | null
  created_at: string
  processed_at: string | null
  metadata_json: {
    analysis?: {
      body_fat_estimate?: { range_low: number; range_high: number } | { unable_to_estimate: true }
      midsection_adiposity?: { level: string } | { unable_to_estimate: true }
    }
    derived?: {
      lean_mass_estimate_kg?: { range_low: number; range_high: number }
    }
  } | null
}

export default function BodyPhotoSection() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<PhotoUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)

  const loadUploads = async () => {
    try {
      const res = await fetch('/api/uploads/photos/list')
      if (res.ok) {
        const data = await res.json()
        setUploads(data.uploads || [])
      }
    } catch (err) {
      console.error('Error loading photos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUploads()
  }, [])

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const handlePickFile = () => {
    if (!consentChecked) {
      setError('Please acknowledge the privacy notice first')
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', 'data_page')

      setUploading(false)
      setAnalyzing(true)

      const res = await fetch('/api/uploads/photos/analyze', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.user_message || data.error || 'Analysis failed')
        return
      }

      await loadUploads()
    } catch (err) {
      console.error('Upload error:', err)
      setError('Something went wrong')
    } finally {
      setUploading(false)
      setAnalyzing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (uploadId: string) => {
    setDeletingId(uploadId)
    try {
      const res = await fetch(`/api/uploads/photos/${uploadId}/delete`, { method: 'DELETE' })
      if (res.ok) {
        await loadUploads()
        window.dispatchEvent(new Event('scorecard-updated'))
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(null)
    }
  }

  const isUnableToEstimate = (val: unknown): boolean => {
    return typeof val === 'object' && val !== null && 'unable_to_estimate' in val
  }

  const getMetrics = (upload: PhotoUpload) => {
    const analysis = upload.metadata_json?.analysis
    const derived = upload.metadata_json?.derived
    const metrics: { label: string; value: string; color: string }[] = []

    if (analysis?.body_fat_estimate && !isUnableToEstimate(analysis.body_fat_estimate)) {
      const bf = analysis.body_fat_estimate as { range_low: number; range_high: number }
      metrics.push({ label: 'Body fat', value: `${bf.range_low}-${bf.range_high}%`, color: 'bg-[#007AFF]/10 text-[#007AFF]' })
    }

    if (derived?.lean_mass_estimate_kg) {
      const lm = derived.lean_mass_estimate_kg
      metrics.push({ label: 'Lean mass', value: `${lm.range_low}-${lm.range_high} kg`, color: 'bg-[#34C759]/10 text-[#34C759]' })
    }

    if (analysis?.midsection_adiposity && !isUnableToEstimate(analysis.midsection_adiposity)) {
      const mid = analysis.midsection_adiposity as { level: string }
      metrics.push({ label: 'Midsection', value: mid.level, color: 'bg-[#FF9500]/10 text-[#FF9500]' })
    }

    return metrics
  }

  return (
    <section>
      <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Body Composition</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#5856D6]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#5856D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[17px] font-semibold text-black">Photo analysis</h3>
              <p className="text-[13px] text-[#8E8E93]">AI estimates body fat and composition</p>
            </div>
          </div>

          {/* Privacy consent */}
          <label className="flex items-start gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#C7C7CC] text-[#007AFF] focus:ring-[#007AFF]"
            />
            <span className="text-[13px] text-[#8E8E93]">
              I understand my photo will be analyzed by AI. It&apos;s stored securely and only I can access it.
            </span>
          </label>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          
          <button
            onClick={handlePickFile}
            disabled={uploading || analyzing}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[15px] font-medium rounded-xl transition-colors ${
              consentChecked
                ? 'text-white bg-[#5856D6] hover:bg-[#4B49B8] active:bg-[#3E3D9A]'
                : 'text-[#8E8E93] bg-[#E5E5EA]'
            } disabled:opacity-50`}
          >
            {uploading || analyzing ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {analyzing ? 'Analyzing...' : 'Uploading...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Add photo
              </>
            )}
          </button>

          {error && <div className="mt-2 p-2 rounded-lg bg-[#FF3B30]/10 text-[#FF3B30] text-[13px]">{error}</div>}
        </div>

        {/* Upload History */}
        {loading ? (
          <div className="p-4 text-[14px] text-[#8E8E93]">Loading...</div>
        ) : uploads.length === 0 ? (
          <div className="p-4 text-[14px] text-[#8E8E93]">No photos yet</div>
        ) : (
          <div className="divide-y divide-[#E5E5EA]">
            {uploads.map((upload) => {
              const metrics = getMetrics(upload)
              return (
                <div key={upload.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-medium text-[#3C3C43]">Body photo</span>
                        <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
                          upload.status === 'completed' ? 'bg-[#34C759]/10 text-[#34C759]' :
                          upload.status === 'failed' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
                          'bg-[#FF9500]/10 text-[#FF9500]'
                        }`}>
                          {upload.status === 'completed' ? 'Analyzed' : upload.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#8E8E93]">
                        {formatDate(upload.created_at)}
                        {upload.processed_at && <span className="text-[#34C759]"> · Analyzed {formatDate(upload.processed_at)}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(upload.id)}
                      disabled={deletingId === upload.id}
                      className="text-[13px] text-[#FF3B30] hover:underline disabled:opacity-50"
                    >
                      {deletingId === upload.id ? '...' : 'Delete'}
                    </button>
                  </div>
                  
                  {metrics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {metrics.map((m, i) => (
                        <span key={i} className={`text-[12px] px-2 py-1 rounded-full ${m.color}`}>
                          {m.label}: {m.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h3 className="text-[17px] font-semibold text-black mb-2">Delete photo?</h3>
            <p className="text-[14px] text-[#3C3C43] mb-5">
              This will remove the photo and any body composition data extracted from it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-[15px] font-medium text-[#007AFF] bg-[#F2F2F7] rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={!!deletingId}
                className="flex-1 px-4 py-2.5 text-[15px] font-medium text-white bg-[#FF3B30] rounded-xl disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

