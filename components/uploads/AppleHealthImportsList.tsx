'use client'

import { useEffect, useState } from 'react'

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

interface Props {
  onDelete?: () => void
}

export default function AppleHealthImportsList({ onDelete }: Props) {
  const [imports, setImports] = useState<AppleHealthImport[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadImports = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/apple-health-imports')
      if (!res.ok) {
        throw new Error('Failed to load imports')
      }
      const data = await res.json()
      setImports(data.imports || [])
    } catch (err) {
      console.error(err)
      setError('Failed to load imports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImports()
  }, [])

  const handleDelete = async (importId: string) => {
    setDeletingId(importId)
    setError(null)

    try {
      const res = await fetch(`/api/apple-health-imports/${importId}/delete`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete import')
      }

      // Reload imports
      await loadImports()

      // Reload scorecard if regenerated
      const data = await res.json()
      if (data.regenerated) {
        // Trigger scorecard refresh (UI will poll and update)
        window.dispatchEvent(new Event('scorecard-updated'))
      }

      // Call parent callback
      if (onDelete) {
        onDelete()
      }

      setShowConfirm(null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to delete import')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const statusBadge = (status: ImportStatus) => {
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

  const getFileName = (filePath: string): string => {
    const parts = filePath.split('/')
    const filename = parts[parts.length - 1]
    // Remove UUID prefix if present
    return filename.replace(/^[a-f0-9-]+-/, '') || 'Apple Health export'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="text-[15px] text-[#8E8E93]">Loading imports...</div>
      </div>
    )
  }

  if (imports.length === 0) {
    return null // Don't show empty state
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[20px] font-semibold text-black">Apple Health Imports</h2>
      
      {error && (
        <div className="p-3 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-[15px]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {imports.map((importRow) => (
          <div
            key={importRow.id}
            className="bg-white rounded-xl shadow-sm p-4 border border-[#E5E5EA]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[15px] font-medium text-[#3C3C43] truncate">
                    {getFileName(importRow.file_path)}
                  </span>
                  {statusBadge(importRow.status)}
                </div>
                
                <div className="text-[13px] text-[#8E8E93] space-y-0.5">
                  {importRow.file_size && (
                    <div>Size: {Math.round(importRow.file_size / 1024 / 1024 * 10) / 10} MB</div>
                  )}
                  <div>Uploaded: {formatDate(importRow.uploaded_at || importRow.created_at)}</div>
                  {importRow.processed_at && (
                    <div className="text-[#34C759]">Processed: {formatDate(importRow.processed_at)}</div>
                  )}
                  {importRow.error_message && (
                    <div className="text-[#FF3B30] mt-1">Error: {importRow.error_message}</div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowConfirm(importRow.id)}
                disabled={deletingId === importRow.id}
                className="px-3 py-1.5 text-[13px] font-medium text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === importRow.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-[20px] font-semibold text-black mb-2">
              Delete Apple Health import?
            </h3>
            <p className="text-[15px] text-[#3C3C43] mb-6 leading-relaxed">
              This will remove the uploaded file and all health metrics extracted from it. 
              Your Prime Scorecard will be recalculated and may change (including confidence). 
              This can&apos;t be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-3 text-[17px] font-medium text-[#007AFF] bg-[#F2F2F7] rounded-xl hover:bg-[#E5E5EA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showConfirm)}
                disabled={deletingId === showConfirm}
                className="flex-1 px-4 py-3 text-[17px] font-medium text-white bg-[#FF3B30] rounded-xl hover:bg-[#D32F2F] active:bg-[#C62828] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === showConfirm ? 'Deleting...' : 'Delete import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

