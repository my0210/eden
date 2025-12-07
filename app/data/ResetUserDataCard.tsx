'use client'

import { useState } from 'react'

type ResetResult = {
  ok: boolean
  userId?: string
  results?: Record<string, { deleted?: number; error?: string }>
  error?: string
}

export default function ResetUserDataCard() {
  const [isResetting, setIsResetting] = useState(false)
  const [result, setResult] = useState<ResetResult | null>(null)

  const handleReset = async () => {
    const confirmed = window.confirm(
      'This will delete your profile, metrics, plans, messages and Apple Health imports for this account. This cannot be undone. Continue?'
    )

    if (!confirmed) return

    setIsResetting(true)
    setResult(null)

    try {
      const res = await fetch('/api/dev/reset-user', { method: 'POST' })
      const data: ResetResult = await res.json()
      setResult(data)
      
      if (data.ok) {
        // Reload page after short delay to show fresh state
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (err) {
      console.error('Reset error:', err)
      setResult({ ok: false, error: 'Network error. Check console.' })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-red-100 bg-red-50/70 p-4 text-sm">
      <p className="font-semibold text-red-800">Developer tools</p>
      <p className="mt-1 text-xs text-red-700">
        Reset all Eden data for this account so you can re-run onboarding.
      </p>
      <button
        onClick={handleReset}
        disabled={isResetting}
        className="mt-3 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isResetting ? 'Resetting...' : 'Reset my Eden data'}
      </button>
      
      {result && (
        <div className="mt-3">
          {result.ok ? (
            <p className="text-xs text-green-700">
              ✓ All Eden data has been reset. Reloading page...
            </p>
          ) : (
            <p className="text-xs text-red-700">
              ✗ Reset had errors. See details below.
            </p>
          )}
          
          {result.results && (
            <div className="mt-2 text-xs font-mono bg-white/50 rounded p-2 max-h-48 overflow-auto">
              {Object.entries(result.results).map(([table, r]) => (
                <div key={table} className={r.error ? 'text-red-600' : 'text-green-700'}>
                  {table}: {r.error ? `ERROR: ${r.error}` : `deleted ${r.deleted}`}
                </div>
              ))}
            </div>
          )}
          
          {result.error && (
            <p className="mt-2 text-xs text-red-600 font-mono">{result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
