'use client'

import { useEffect, useRef, useState } from 'react'

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp']

interface PhotoUploadRow {
  id: string
  user_id: string
  kind: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  status: string
  created_at: string
  processed_at: string | null
  failed_at: string | null
  error_message: string | null
}

interface Props {
  source?: string
  kind?: string
  pollIntervalMs?: number
}

export default function PhotoUpload({ source = 'data', kind = 'body_photo', pollIntervalMs = 4000 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [recent, setRecent] = useState<PhotoUploadRow[]>([])
  const [total, setTotal] = useState(0)

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/uploads/status')
      if (!res.ok) throw new Error('Failed to load status')
      const data = await res.json()
      if (data?.photos) {
        setRecent(data.photos.recent || [])
        setTotal(data.photos.total || 0)
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

  const handlePick = () => fileInputRef.current?.click()

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArr = Array.from(files)
    const invalid = fileArr.filter(f => !ALLOWED.includes(f.type))
    if (invalid.length) {
      setError(`Invalid file types: ${invalid.map(f => f.name).join(', ')}`)
      return
    }

    setUploading(true)
    setError(null)
    setMessage(null)

    try {
      const formData = new FormData()
      fileArr.forEach(f => formData.append('files', f))
      formData.append('source', source)
      formData.append('kind', kind)

      const res = await fetch('/api/uploads/photos', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Upload failed')
        return
      }
      if (data.errors?.length) {
        setError(data.errors.join('; '))
      }
      if (data.uploads?.length) {
        setMessage(`Uploaded ${data.uploads.length} photo${data.uploads.length > 1 ? 's' : ''}`)
      }
      await loadStatus()
    } catch (err) {
      console.error(err)
      setError('Something went wrong during upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const statusBadge = (status?: string | null) => {
    if (!status) return null
    const color =
      status === 'completed' ? 'bg-[#34C759]/10 text-[#34C759]' :
      status === 'processing' ? 'bg-[#FF9500]/10 text-[#FF9500]' :
      status === 'failed' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
      'bg-[#007AFF]/10 text-[#007AFF]'
    return (
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED.join(',')}
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handlePick}
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
              Upload Photos
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
          <span>Recent uploads</span>
          <span className="text-[13px] text-[#8E8E93]">Total: {total}</span>
        </div>

        {recent.length === 0 ? (
          <div className="text-[13px] text-[#8E8E93]">No photo uploads yet</div>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="min-w-0">
                  <div className="text-[14px] text-[#3C3C43] truncate">{r.file_path.split('/').pop()}</div>
                  <div className="text-[12px] text-[#8E8E93]">
                    {r.mime_type || 'image'} · {Math.round(((r.file_size || 0) / 1024 / 1024) * 10) / 10} MB
                  </div>
                </div>
                {statusBadge(r.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

