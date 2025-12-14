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

export default function AppleHealthUpload({ source = 'data', pollIntervalMs = 4000 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [latestImport, setLatestImport] = useState<AppleHealthImport | null>(null)
  const [statusCounts, setStatusCounts] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 })

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/uploads/status')
      if (!res.ok) {
        throw new Error('Failed to load status')
      }
      const data = await res.json()
      if (data?.appleHealth) {
        setLatestImport(data.appleHealth.latest || null)
        setStatusCounts({
          pending: data.appleHealth.pending ?? 0,
          processing: data.appleHealth.processing ?? 0,
          completed: data.appleHealth.completed ?? 0,
          failed: data.appleHealth.failed ?? 0,
        })
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadStatus()
    const timer = setInterval(loadStatus, pollIntervalMs)
    return () => clearInterval(timer)
  }, [pollIntervalMs])

  const handlePickFile = () => fileInputRef.current?.click()

  /**
   * Upload via form data (for small files < 4MB)
   */
  const uploadViaFormData = async (file: File): Promise<boolean> => {
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
      setMessage('Preparing upload...')
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
      setMessage('Uploading to storage...')
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
      setMessage('Confirming upload...')
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

    setUploading(true)
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
        setMessage('Uploaded. Processing will start shortly.')
        await loadStatus()
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong during upload')
    } finally {
      setUploading(false)
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
      'Uploaded'
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
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[17px] font-medium text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
        >
          {uploading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Uploading…'}
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
      {uploadProgress !== null && (
        <div className="w-full bg-[#E5E5EA] rounded-full h-2">
          <div 
            className="bg-[#007AFF] h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
          {error}
        </div>
      )}
      {message && !error && (
        <div className="p-3 rounded-xl bg-[#34C759]/10 text-[#34C759] text-[15px]">
          {message}
        </div>
      )}

      <div className="bg-[#F2F2F7] rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-[15px] text-[#3C3C43]">
          <span>Latest</span>
          {statusBadge(latestImport?.status)}
        </div>
        {latestImport ? (
          <div className="text-[13px] text-[#8E8E93] space-y-0.5">
            <div>File: {latestImport.file_path.split('/').pop()}</div>
            <div>Size: {Math.round((latestImport.file_size || 0) / 1024 / 1024 * 10) / 10} MB</div>
            <div>Uploaded: {latestImport.uploaded_at || latestImport.created_at}</div>
            {latestImport.error_message && (
              <div className="text-[#FF3B30]">Error: {latestImport.error_message}</div>
            )}
          </div>
        ) : (
          <div className="text-[13px] text-[#8E8E93]">No uploads yet</div>
        )}
        <div className="text-[13px] text-[#8E8E93] flex gap-3">
          <span>Queued: {statusCounts.pending}</span>
          <span>Processing: {statusCounts.processing}</span>
          <span>Done: {statusCounts.completed}</span>
          <span>Failed: {statusCounts.failed}</span>
        </div>
      </div>
    </div>
  )
}
