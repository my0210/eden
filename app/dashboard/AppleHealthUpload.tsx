'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AppleHealthUploadProps {
  userId: string
}

export default function AppleHealthUpload({ userId }: AppleHealthUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setIsUploading(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const filePath = `${userId}/${Date.now()}-${file.name}`
      
      const { error: uploadError } = await supabase.storage
        .from('apple_health_uploads')
        .upload(filePath, file)

      if (uploadError) {
        setMessage({ type: 'error', text: 'Upload failed: ' + uploadError.message })
        setIsUploading(false)
        return
      }

      const { data: importData, error: insertError } = await supabase
        .from('apple_health_imports')
        .insert({ user_id: userId, file_path: filePath, file_size: file.size })
        .select('id')
        .single()

      if (insertError || !importData) {
        setMessage({ type: 'error', text: 'Failed to record upload' })
        setIsUploading(false)
        return
      }

      // Auto-process
      setIsUploading(false)
      setIsProcessing(true)

      const res = await fetch('/api/apple-health/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: importData.id }),
      })

      const data = await res.json()
      
      if (res.ok) {
        setMessage({ type: 'success', text: `Successfully imported ${data.importedCount ?? 0} metrics!` })
        setTimeout(() => window.location.href = '/dashboard', 2000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Processing failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' })
    } finally {
      setIsUploading(false)
      setIsProcessing(false)
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.xml"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <button
        onClick={handleClick}
        disabled={isUploading || isProcessing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition"
      >
        {isUploading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Uploading...</span>
          </>
        ) : isProcessing ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Processing data...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload Health Export</span>
          </>
        )}
      </button>

      {fileName && !message && (
        <p className="mt-2 text-xs text-gray-500 text-center">
          {fileName}
        </p>
      )}

      {message && (
        <div className={`mt-3 px-4 py-3 rounded-xl text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
