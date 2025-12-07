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
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[17px] font-medium text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
      >
        {isUploading ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading…
          </>
        ) : isProcessing ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Health Data
          </>
        )}
      </button>

      {message && (
        <div className={`mt-3 px-4 py-3 rounded-xl text-[15px] ${
          message.type === 'success' 
            ? 'bg-[#34C759]/10 text-[#34C759]' 
            : 'bg-[#FF3B30]/10 text-[#FF3B30]'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
