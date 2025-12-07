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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const filePath = `${userId}/${Date.now()}-${file.name}`
      
      const { error: uploadError } = await supabase.storage
        .from('apple_health_uploads')
        .upload(filePath, file)

      if (uploadError) {
        setMessage({ type: 'error', text: 'Upload failed' })
        return
      }

      const { data: importData, error: insertError } = await supabase
        .from('apple_health_imports')
        .insert({ user_id: userId, file_path: filePath, file_size: file.size })
        .select('id')
        .single()

      if (insertError || !importData) {
        setMessage({ type: 'error', text: 'Failed to record upload' })
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
        setMessage({ type: 'success', text: `Imported ${data.importedCount ?? 0} metrics` })
        // Refresh page to show new data
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'Processing failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' })
    } finally {
      setIsUploading(false)
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="relative">
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
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 disabled:opacity-50 transition"
      >
        {isUploading || isProcessing ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{isUploading ? 'Uploading' : 'Processing'}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload</span>
          </>
        )}
      </button>

      {/* Toast message */}
      {message && (
        <div className={`absolute top-full right-0 mt-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg ${
          message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
