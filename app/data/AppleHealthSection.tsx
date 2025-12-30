'use client'

import { useEffect, useRef, useState } from 'react'

type ImportStatus = 'uploaded' | 'processing' | 'completed' | 'failed' | 'pending'

interface AppleHealthImport {
  id: string
  status: ImportStatus
  file_path: string
  file_size: number | null
  uploaded_at: string | null
  processed_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
}

const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024
const POLL_INTERVAL_ACTIVE = 3000
const POLL_INTERVAL_IDLE = 15000

type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'confirming'

export default function AppleHealthSection() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [imports, setImports] = useState<AppleHealthImport[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const isUploading = uploadPhase !== 'idle'

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

  const loadImports = async () => {
    try {
      const res = await fetch('/api/apple-health-imports')
      if (res.ok) {
        const data = await res.json()
        setImports(data.imports || [])
      }
    } catch (err) {
      console.error('Error loading imports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImports()
    
    // Poll for updates
    const hasActive = imports.some(i => 
      i.status === 'pending' || i.status === 'processing' || i.status === 'uploaded'
    )
    const interval = hasActive ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE
    const timer = setInterval(loadImports, interval)
    return () => clearInterval(timer)
  }, [imports.length])

  const handlePickFile = () => fileInputRef.current?.click()

  const uploadViaFormData = async (file: File): Promise<boolean> => {
    setUploadPhase('uploading')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('source', 'data')

    const res = await fetch('/api/uploads/apple-health', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Upload failed')
      return false
    }
    return true
  }

  const uploadViaSignedUrl = async (file: File): Promise<boolean> => {
    try {
      setUploadPhase('preparing')
      const signedUrlRes = await fetch('/api/uploads/apple-health/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          source: 'data',
        }),
      })

      if (!signedUrlRes.ok) {
        const data = await signedUrlRes.json()
        setError(data.error || 'Failed to prepare upload')
        return false
      }

      const { signedUrl, filePath } = await signedUrlRes.json()

      setUploadPhase('uploading')
      setUploadProgress(0)

      const xhr = new XMLHttpRequest()
      
      const uploadPromise = new Promise<boolean>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(true)
          else reject(new Error(`Upload failed with status ${xhr.status}`))
        })
        xhr.addEventListener('error', () => reject(new Error('Network error')))
      })

      xhr.open('PUT', signedUrl)
      xhr.setRequestHeader('Content-Type', 'application/zip')
      xhr.send(file)
      await uploadPromise

      setUploadPhase('confirming')
      setUploadProgress(null)

      const confirmRes = await fetch('/api/uploads/apple-health/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, fileSize: file.size, filename: file.name, source: 'data' }),
      })

      if (!confirmRes.ok) {
        const data = await confirmRes.json()
        setError(data.error || 'Failed to confirm upload')
        return false
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return false
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a .zip file exported from Apple Health')
      return
    }

    setError(null)
    setMessage(null)
    setUploadProgress(null)

    try {
      const success = file.size >= DIRECT_UPLOAD_THRESHOLD
        ? await uploadViaSignedUrl(file)
        : await uploadViaFormData(file)

      if (success) {
        setMessage('Upload complete! Processing will begin shortly.')
        await loadImports()
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong during upload')
    } finally {
      setUploadPhase('idle')
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (importId: string) => {
    setDeletingId(importId)
    try {
      const res = await fetch(`/api/apple-health-imports/${importId}/delete`, { method: 'DELETE' })
      if (res.ok) {
        await loadImports()
        window.dispatchEvent(new Event('scorecard-updated'))
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(null)
    }
  }

  const statusBadge = (status: ImportStatus) => {
    const styles = {
      completed: 'bg-[#34C759]/10 text-[#34C759]',
      processing: 'bg-[#FF9500]/10 text-[#FF9500]',
      failed: 'bg-[#FF3B30]/10 text-[#FF3B30]',
      pending: 'bg-[#007AFF]/10 text-[#007AFF]',
      uploaded: 'bg-[#007AFF]/10 text-[#007AFF]',
    }
    const labels = {
      completed: 'Completed',
      processing: 'Processing',
      failed: 'Failed',
      pending: 'Queued',
      uploaded: 'Queued',
    }
    return (
      <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  return (
    <section>
      <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Apple Health</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF2D55]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#FF2D55]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[17px] font-semibold text-black">Import health data</h3>
              <p className="text-[13px] text-[#8E8E93]">Health → Profile → Export All Health Data</p>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleFileChange} />
          
          <button
            onClick={handlePickFile}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[15px] font-medium text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {uploadPhase === 'preparing' && 'Preparing…'}
                {uploadPhase === 'uploading' && uploadProgress !== null && `Uploading ${uploadProgress}%`}
                {uploadPhase === 'uploading' && uploadProgress === null && 'Uploading…'}
                {uploadPhase === 'confirming' && 'Finalizing…'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload .zip file
              </>
            )}
          </button>

          {uploadPhase === 'uploading' && uploadProgress !== null && (
            <div className="mt-2 w-full bg-[#E5E5EA] rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-[#007AFF] transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          {error && <div className="mt-2 p-2 rounded-lg bg-[#FF3B30]/10 text-[#FF3B30] text-[13px]">{error}</div>}
          {message && !error && <div className="mt-2 p-2 rounded-lg bg-[#34C759]/10 text-[#34C759] text-[13px]">✓ {message}</div>}
        </div>

        {/* Import History */}
        {loading ? (
          <div className="p-4 text-[14px] text-[#8E8E93]">Loading...</div>
        ) : imports.length === 0 ? (
          <div className="p-4 text-[14px] text-[#8E8E93]">No imports yet</div>
        ) : (
          <div className="divide-y divide-[#E5E5EA]">
            {imports.map((imp) => (
              <div key={imp.id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-medium text-[#3C3C43] truncate">
                      {imp.file_path.split('/').pop()?.replace(/^[a-f0-9-]+-/, '') || 'Export'}
                    </span>
                    {statusBadge(imp.status)}
                  </div>
                  <div className="text-[12px] text-[#8E8E93] space-y-0.5">
                    {imp.file_size && <span>{Math.round(imp.file_size / 1024 / 1024 * 10) / 10} MB · </span>}
                    <span>Uploaded {formatDate(imp.uploaded_at || imp.created_at)}</span>
                    {imp.processed_at && (
                      <span className="text-[#34C759]"> · Processed {formatDate(imp.processed_at)}</span>
                    )}
                  </div>
                  {imp.error_message && (
                    <div className="mt-1 text-[12px] text-[#FF3B30]">{imp.error_message}</div>
                  )}
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(imp.id)}
                  disabled={deletingId === imp.id}
                  className="text-[13px] text-[#FF3B30] hover:underline disabled:opacity-50"
                >
                  {deletingId === imp.id ? '...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h3 className="text-[17px] font-semibold text-black mb-2">Delete import?</h3>
            <p className="text-[14px] text-[#3C3C43] mb-5">
              This will remove the file and all health metrics extracted from it. Your scorecard will be recalculated.
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

