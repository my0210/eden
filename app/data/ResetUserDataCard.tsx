'use client'

import { useState } from 'react'

export default function ResetUserDataCard() {
  const [isResetting, setIsResetting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleReset = async () => {
    const confirmed = window.confirm(
      'This will delete your profile, metrics, plans, messages and Apple Health imports for this account. This cannot be undone. Continue?'
    )

    if (!confirmed) return

    setIsResetting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/dev/reset-user', { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.ok) {
        setMessage({ type: 'success', text: 'All Eden data for this account has been reset.' })
      } else {
        setMessage({ type: 'error', text: 'Reset failed. Check the console and try again.' })
      }
    } catch (err) {
      console.error('Reset error:', err)
      setMessage({ type: 'error', text: 'Reset failed. Check the console and try again.' })
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
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}

