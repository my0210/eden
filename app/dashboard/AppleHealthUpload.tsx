'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AppleHealthUploadProps {
  userId: string
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export default function AppleHealthUpload({ userId }: AppleHealthUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Import tracking state
  const [importId, setImportId] = useState<string | null>(null)
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processMessage, setProcessMessage] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setStatus('idle')
      setErrorMessage('')
    } else {
      setFileName('')
    }
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    
    if (!file) {
      setErrorMessage('Please select a file first.')
      setStatus('error')
      return
    }

    setStatus('uploading')
    setErrorMessage('')

    try {
      const supabase = createClient()
      
      // Generate unique file path: userId/timestamp-filename
      const filePath = `${userId}/${Date.now()}-${file.name}`
      
      const { data, error } = await supabase.storage
        .from('apple_health_uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Upload error:', error)
        setErrorMessage(error.message)
        setStatus('error')
        return
      }

      // Record the upload in apple_health_imports table and get the id back
      const { data: insertData, error: insertError } = await supabase
        .from('apple_health_imports')
        .insert({
          user_id: userId,
          file_path: filePath,
          file_size: file.size,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Database insert error:', insertError)
        setErrorMessage(`File uploaded but failed to record: ${insertError.message}`)
        setStatus('error')
        return
      }

      // Store the import id and reset processing state
      setImportId(insertData.id)
      setProcessMessage(null)
      setIsProcessing(false)
      
      setStatus('success')
      setFileName('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Upload exception:', err)
      setErrorMessage('An unexpected error occurred.')
      setStatus('error')
    }
  }

  const handleProcess = async () => {
    if (!importId) return
    
    setProcessMessage(null)
    setIsProcessing(true)
    
    try {
      const res = await fetch('/api/apple-health/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        const count = data.importedCount ?? 0
        setProcessMessage(`Processing completed. Imported ${count} metric${count !== 1 ? 's' : ''}.`)
      } else {
        setProcessMessage(data.error || 'Processing failed. Please try again.')
      }
    } catch (err) {
      console.error('Process error:', err)
      setProcessMessage('Processing failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const resetUpload = () => {
    setStatus('idle')
    setErrorMessage('')
    setFileName('')
    setImportId(null)
    setProcessMessage(null)
    setIsProcessing(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-white rounded-xl border-2 border-emerald-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-emerald-200 bg-emerald-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <h2 className="text-lg font-semibold text-emerald-700">
            Upload Apple Health Data
          </h2>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-5">
        <p className="text-sm text-gray-600 mb-4">
          Export your Apple Health data from your iPhone as a <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">.zip</code> file 
          and upload it here. Go to <span className="font-medium">Health app → Profile → Export All Health Data</span>.
        </p>

        {status === 'success' ? (
          <div className="space-y-4">
            {/* Upload Success */}
            <div className="flex items-center gap-2 text-emerald-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Upload successful!</span>
            </div>
            
            {/* Process Button */}
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleProcess}
                disabled={!importId || isProcessing}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                  hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                  flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Process Apple Health data</span>
                  </>
                )}
              </button>
              
              {/* Processing Status Message */}
              {processMessage && (
                <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${
                  processMessage.includes('completed') 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-red-600 bg-red-50'
                }`}>
                  {processMessage}
                </div>
              )}
            </div>
            
            {/* Upload Another */}
            <button
              onClick={resetUpload}
              className="text-sm text-emerald-600 hover:text-emerald-700 underline"
            >
              Upload another file
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Input */}
            <div>
              <label className="block">
                <span className="sr-only">Choose file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.xml"
                  onChange={handleFileChange}
                  disabled={status === 'uploading'}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-medium
                    file:bg-emerald-50 file:text-emerald-700
                    hover:file:bg-emerald-100
                    file:cursor-pointer file:transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </label>
              {fileName && (
                <p className="mt-2 text-xs text-gray-500">
                  Selected: <span className="font-medium">{fileName}</span>
                </p>
              )}
            </div>

            {/* Error Message */}
            {status === 'error' && errorMessage && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {errorMessage}
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={status === 'uploading' || !fileName}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium
                hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                flex items-center justify-center gap-2"
            >
              {status === 'uploading' ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Uploading…</span>
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
          </div>
        )}
      </div>
    </div>
  )
}
