'use client'

import { useEffect, useRef, useState } from 'react'

type ImportStatus = 'uploaded' | 'processing' | 'completed' | 'failed' | 'pending'

interface AppleHealthImport {
  id: string
  status: ImportStatus
  file_path: string
  file_size: number
  uploaded_at: string | null
  processing_started_at: string | null
  processed_at: string | null
  failed_at: string | null
  error_message: string | null
  source: string | null
  created_at: string
}

interface Props {
  source?: string
  pollIntervalMs?: number
}

// Files larger than 4MB use direct-to-storage upload (bypasses Vercel limits)
const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024

// Polling intervals
const POLL_INTERVAL_ACTIVE = 3000 // 3s when queued/processing
const POLL_INTERVAL_IDLE = 10000 // 10s when completed/failed

type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'confirming'

export default function AppleHealthUpload({ source = 'data', pollIntervalMs = 4000 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [latestImport, setLatestImport] = useState<AppleHealthImport | null>(null)
  const [statusCounts, setStatusCounts] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 })
  const [scorecardUpdated, setScorecardUpdated] = useState(false)
  const [previousStatus, setPreviousStatus] = useState<ImportStatus | null>(null)
  const [previousProcessedAt, setPreviousProcessedAt] = useState<string | null>(null)
  
  const isUploading = uploadPhase !== 'idle'

  // Format date for display
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'just now'
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateString
    }
  }

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/uploads/status')
      if (!res.ok) {
        throw new Error('Failed to load status')
      }
      const data = await res.json()
      if (data?.appleHealth) {
        const newLatest = data.appleHealth.latest || null
        setLatestImport(newLatest)
        setStatusCounts({
          pending: data.appleHealth.pending ?? 0,
          processing: data.appleHealth.processing ?? 0,
          completed: data.appleHealth.completed ?? 0,
          failed: data.appleHealth.failed ?? 0,
        })

        // Check if status changed from processing to completed
        if (
          previousStatus === 'processing' && 
          newLatest?.status === 'completed' &&
          newLatest.processed_at !== previousProcessedAt
        ) {
          setScorecardUpdated(true)
          // Clear message after 10 seconds
          setTimeout(() => setScorecardUpdated(false), 10000)
        }

        setPreviousStatus(newLatest?.status || null)
        setPreviousProcessedAt(newLatest?.processed_at || null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Dynamic polling: faster when queued/processing
  useEffect(() => {
    // Initial load
    loadStatus()
    
    // Determine polling interval based on current status
    const status = latestImport?.status
    const interval = (status === 'pending' || status === 'processing' || status === 'uploaded')
      ? POLL_INTERVAL_ACTIVE
      : POLL_INTERVAL_IDLE

    const timer = setInterval(loadStatus, interval)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestImport?.status]) // Re-run when status changes to adjust polling

  const handlePickFile = () => fileInputRef.current?.click()

  /**
   * Upload via form data (for small files < 4MB)
   */
  const uploadViaFormData = async (file: File): Promise<boolean> => {
    setUploadPhase('uploading')
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('source', source)

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

  /**
   * Upload via signed URL (for large files >= 4MB)
   * This bypasses Vercel's body size limits
   */
  const uploadViaSignedUrl = async (file: File): Promise<boolean> => {
    try {
      // 1. Get signed upload URL
      setUploadPhase('preparing')
      const signedUrlRes = await fetch('/api/uploads/apple-health/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          source,
        }),
      })

      if (!signedUrlRes.ok) {
        const data = await signedUrlRes.json()
        setError(data.error || 'Failed to prepare upload')
        return false
      }

      const { signedUrl, filePath } = await signedUrlRes.json()

      // 2. Upload directly to Supabase Storage
      setUploadPhase('uploading')
      setUploadProgress(0)

      const xhr = new XMLHttpRequest()
      
      const uploadPromise = new Promise<boolean>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(percent)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true)
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'))
        })
      })

      xhr.open('PUT', signedUrl)
      xhr.setRequestHeader('Content-Type', 'application/zip')
      xhr.send(file)

      await uploadPromise

      // 3. Confirm upload in database
      setUploadPhase('confirming')
      setUploadProgress(null)

      const confirmRes = await fetch('/api/uploads/apple-health/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          fileSize: file.size,
          filename: file.name,
          source,
        }),
      })

      if (!confirmRes.ok) {
        const data = await confirmRes.json()
        setError(data.error || 'Failed to confirm upload')
        return false
      }

      return true
    } catch (err) {
      console.error('Signed URL upload error:', err)
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
      let success: boolean

      // Use signed URL for large files to bypass Vercel limits
      if (file.size >= DIRECT_UPLOAD_THRESHOLD) {
        success = await uploadViaSignedUrl(file)
      } else {
        success = await uploadViaFormData(file)
      }

      if (success) {
        setMessage('✓ Upload complete! Processing will begin shortly.')
        setScorecardUpdated(false)
        await loadStatus()
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

  const handleRetry = async () => {
    if (!latestImport || latestImport.status !== 'failed') return

    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/apple-health/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: latestImport.id }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to retry import')
        return
      }

      setMessage('✓ Import reset to pending. Processing will begin shortly.')
      await loadStatus()
    } catch (err) {
      console.error(err)
      setError('Failed to retry import')
    }
  }

  const statusBadge = (status?: ImportStatus | null) => {
    if (!status) return null
    const color =
      status === 'completed' ? 'bg-[#34C759]/10 text-[#34C759]' :
      status === 'processing' ? 'bg-[#FF9500]/10 text-[#FF9500]' :
      status === 'failed' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
      'bg-[#007AFF]/10 text-[#007AFF]'
    const label =
      status === 'completed' ? 'Completed' :
      status === 'processing' ? 'Processing' :
      status === 'failed' ? 'Failed' :
      'Queued'
    return (
      <span className={`text-[13px] font-medium px-2.5 py-1 rounded-full ${color}`}>
        {label}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handlePickFile}
          disabled={isUploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[17px] font-medium text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
        >
          {isUploading ? (
            <>
              {uploadPhase !== 'confirming' && (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {uploadPhase === 'preparing' && 'Preparing…'}
              {uploadPhase === 'uploading' && uploadProgress !== null && `Uploading ${uploadProgress}%`}
              {uploadPhase === 'uploading' && uploadProgress === null && 'Uploading…'}
              {uploadPhase === 'confirming' && '✓ Finalizing…'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Apple Health (.zip)
            </>
          )}
        </button>
      </div>

      {/* Upload progress bar */}
      {uploadPhase === 'uploading' && uploadProgress !== null && (
        <div className="w-full bg-[#E5E5EA] rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              uploadProgress === 100 ? 'bg-[#34C759]' : 'bg-[#007AFF]'
            }`}
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
          {error}
        </div>
      )}
      {message && !error && !isUploading && (
        <div className="p-3 rounded-xl bg-[#34C759]/10 text-[#34C759] text-[15px]">
          {message}
        </div>
      )}

      {scorecardUpdated && latestImport?.status === 'completed' && (
        <div className="p-3 rounded-xl bg-[#007AFF]/10 text-[#007AFF] text-[15px] flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Prime Scorecard updated
        </div>
      )}

      <div className="bg-[#F2F2F7] rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-[15px] text-[#3C3C43]">
          <span>Latest</span>
          {statusBadge(latestImport?.status)}
        </div>
        {latestImport ? (
          <div className="text-[13px] text-[#8E8E93] space-y-1">
            <div>File: {latestImport.file_path.split('/').pop()}</div>
            <div>Size: {Math.round((latestImport.file_size || 0) / 1024 / 1024 * 10) / 10} MB</div>
            <div>Uploaded: {formatDate(latestImport.uploaded_at || latestImport.created_at)}</div>
            {latestImport.processed_at && (
              <div className="text-[#34C759]">
                Processed: {formatDate(latestImport.processed_at)}
              </div>
            )}
            {latestImport.error_message && (
              <div className="text-[#FF3B30] mt-2 p-2 bg-[#FF3B30]/10 rounded-lg">
                <div className="font-medium mb-1">Error:</div>
                <div>{latestImport.error_message}</div>
                {latestImport.status === 'failed' && (
                  <button
                    onClick={handleRetry}
                    className="mt-2 px-3 py-1.5 text-[13px] font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] active:bg-[#0055CC] transition-colors"
                  >
                    Retry Processing
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[13px] text-[#8E8E93]">No uploads yet</div>
        )}
        <div className="text-[13px] text-[#8E8E93] flex gap-3 flex-wrap">
          <span>Queued: {statusCounts.pending}</span>
          <span>Processing: {statusCounts.processing}</span>
          <span>Done: {statusCounts.completed}</span>
          <span>Failed: {statusCounts.failed}</span>
        </div>
      </div>
    </div>
  )
}
