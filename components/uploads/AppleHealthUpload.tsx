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

export default function AppleHealthUpload({ source = 'data', pollIntervalMs = 4000 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
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

    try {
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
        return
      }

      setMessage('Uploaded. Processing will start shortly.')
      await loadStatus()
    } catch (err) {
      console.error(err)
      setError('Something went wrong during upload')
    } finally {
      setUploading(false)
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
              Uploading…
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

      {error && (
        <div className="p-3 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
          {error}
        </div>
      )}
      {message && (
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

