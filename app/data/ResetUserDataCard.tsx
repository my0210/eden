'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ResetResult = {
  ok: boolean
  userId?: string
  results?: Record<string, { deleted?: number; error?: string }>
  error?: string
  message?: string
}

export default function ResetUserDataCard() {
  const router = useRouter()
  const [isResetting, setIsResetting] = useState(false)
  const [isResettingOnboarding, setIsResettingOnboarding] = useState(false)
  const [isResettingCoaching, setIsResettingCoaching] = useState(false)
  const [result, setResult] = useState<ResetResult | null>(null)

  const handleResetAll = async () => {
    const confirmed = window.confirm(
      'This will permanently delete ALL your Eden data:\n\n• Profile & onboarding progress\n• Prime Check answers\n• Scorecards & metrics\n• Coach conversations & plans\n• Apple Health imports\n• Body photos\n\nThis cannot be undone.\n\nContinue?'
    )

    if (!confirmed) return

    setIsResetting(true)
    setResult(null)

    try {
      const res = await fetch('/api/dev/reset-user', { method: 'POST' })
      const data: ResetResult = await res.json()
      setResult(data)
      
      if (data.ok) {
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (err) {
      console.error('Reset error:', err)
      setResult({ ok: false, error: 'Network error. Check console.' })
    } finally {
      setIsResetting(false)
    }
  }

  const handleResetOnboarding = async () => {
    const confirmed = window.confirm(
      'This will reset your onboarding and clear:\n\n• Onboarding progress\n• Goals & identity\n• Prime Check answers\n• Scorecards & metrics\n• Apple Health imports\n• Body photos\n\nYou will start fresh from step 1.\n\nContinue?'
    )

    if (!confirmed) return

    setIsResettingOnboarding(true)
    setResult(null)

    try {
      const res = await fetch('/api/dev/reset-onboarding', { method: 'POST' })
      const data = await res.json()
      
      if (res.ok && data.ok) {
        router.push('/onboarding/1')
      } else {
        setResult({ ok: false, error: data.error || 'Failed to reset onboarding' })
        setIsResettingOnboarding(false)
      }
    } catch (err) {
      console.error('Reset onboarding error:', err)
      setResult({ ok: false, error: 'Network error. Check console.' })
      setIsResettingOnboarding(false)
    }
  }

  const handleResetCoaching = async () => {
    const confirmed = window.confirm(
      'This will clear coaching data only:\n\n• All chat messages with Eden\n• Goals & protocols\n• Actions, habits, check-ins\n\nYour onboarding, profile, scorecard, and uploads will be preserved.\n\nContinue?'
    )

    if (!confirmed) return

    setIsResettingCoaching(true)
    setResult(null)

    try {
      const res = await fetch('/api/dev/reset-coaching', { method: 'POST' })
      const data: ResetResult = await res.json()
      setResult(data)
      
      if (data.ok) {
        setTimeout(() => {
          router.push('/chat')
        }, 1500)
      }
    } catch (err) {
      console.error('Reset coaching error:', err)
      setResult({ ok: false, error: 'Network error. Check console.' })
    } finally {
      setIsResettingCoaching(false)
    }
  }

  const isAnyLoading = isResetting || isResettingOnboarding || isResettingCoaching

  return (
    <div className="mt-8 rounded-xl border border-red-100 bg-red-50/70 p-4 text-sm">
      <p className="font-semibold text-red-800">Developer tools</p>
      <p className="mt-1 text-xs text-red-700">
        Developer-only actions for testing and development.
      </p>
      
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Reset Coaching Only */}
        <button
          onClick={handleResetCoaching}
          disabled={isAnyLoading}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResettingCoaching ? 'Clearing...' : 'Clear coaching only'}
        </button>

        {/* Reset Onboarding Button */}
        <button
          onClick={handleResetOnboarding}
          disabled={isAnyLoading}
          className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResettingOnboarding ? 'Resetting...' : 'Reset onboarding'}
        </button>
        
        {/* Wipe All Data Button */}
        <button
          onClick={handleResetAll}
          disabled={isAnyLoading}
          className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResetting ? 'Resetting...' : 'Wipe all Eden data'}
        </button>
      </div>
      
      {result && (
        <div className="mt-3">
          {result.ok ? (
            <p className="text-xs text-green-700">
              ✓ {result.message || 'Data cleared successfully.'}
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
