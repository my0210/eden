'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PrimeScorecard } from '@/lib/prime-scorecard/types'
import ScorecardView from '@/components/scorecard/ScorecardView'

interface Step8ScorecardRevealProps {
  userId: string
  focusPrimary?: string | null
  focusSecondary?: string | null
}

export default function Step8ScorecardReveal({ 
  userId,
  focusPrimary,
  focusSecondary 
}: Step8ScorecardRevealProps) {
  const router = useRouter()
  const [scorecard, setScorecard] = useState<PrimeScorecard | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadScorecard()
  }, [])

  async function loadScorecard() {
    setLoading(true)
    setError(null)

    try {
      // Try to get latest scorecard first
      const latestRes = await fetch('/api/prime-scorecard/latest')
      
      if (latestRes.ok) {
        const data = await latestRes.json()
        setScorecard(data.scorecard)
        setLoading(false)
        return
      }

      // If no scorecard exists (404), generate one
      if (latestRes.status === 404) {
        const generateRes = await fetch('/api/prime-scorecard/generate', {
          method: 'POST',
        })

        if (generateRes.ok) {
          const data = await generateRes.json()
          setScorecard(data.scorecard)
        } else {
          // Check if it's because there are no metrics
          const errorData = await generateRes.json().catch(() => ({}))
          if (generateRes.status === 400 && errorData.error?.includes('No metrics')) {
            setError('No health data available yet. Import your Apple Health data first.')
          } else {
            setError('Failed to generate scorecard')
          }
        }
      } else {
        setError('Failed to load scorecard')
      }
    } catch (err) {
      console.error('Scorecard load error:', err)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete() {
    setCompleting(true)
    
    try {
      // Call the save endpoint to mark onboarding complete
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 8,
          onboarding_status: 'completed',
          patch: {}
        })
      })

      if (res.ok) {
        // Use replace to prevent back-button returning to onboarding
        router.replace('/chat')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Complete onboarding error:', errorData)
        setError('Failed to complete onboarding')
        setCompleting(false)
      }
    } catch (err) {
      console.error('Complete error:', err)
      setError('Network error')
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-[#007AFF]/10 to-[#34C759]/10 rounded-2xl p-8 text-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#007AFF]/50 to-[#34C759]/50 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-black mb-2">Generating Your Scorecard</h2>
          <p className="text-[15px] text-[#8E8E93]">Analyzing your health data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[#FF3B30]/10 rounded-2xl p-6 text-center">
          <p className="text-[17px] text-[#FF3B30] mb-4">{error}</p>
          <button
            onClick={loadScorecard}
            className="text-[#007AFF] font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Scorecard */}
      {scorecard && (
        <ScorecardView scorecard={scorecard} showHowCalculated={true} />
      )}

      {/* Focus reminder */}
      {focusPrimary && (
        <div className="flex items-center gap-3 p-3 bg-[#F2F2F7] rounded-xl">
          <span className="text-[15px]">🎯</span>
          <span className="text-[15px] text-[#3C3C43]">
            Your focus: <span className="font-medium capitalize">{focusPrimary}</span>
            {focusSecondary && (
              <span className="text-[#8E8E93]"> + {focusSecondary}</span>
            )}
          </span>
        </div>
      )}

      {/* Success message */}
      <div className="text-center py-2">
        <p className="text-[17px] text-[#34C759] font-medium">
          ✓ You&apos;re all set! Let&apos;s start your journey.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5EA]">
        <Link
          href="/onboarding/7"
          className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
        >
          Back
        </Link>

        <button
          onClick={handleComplete}
          disabled={completing}
          className="bg-[#34C759] text-white py-3 px-8 rounded-xl text-[17px] font-semibold hover:bg-[#2DB84D] active:bg-[#28A745] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {completing ? 'Starting...' : 'Go to Coach →'}
        </button>
      </div>
    </div>
  )
}

