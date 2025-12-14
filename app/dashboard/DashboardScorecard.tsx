'use client'

import { useState, useEffect } from 'react'
import { PrimeScorecard } from '@/lib/prime-scorecard/types'
import ScorecardView from '@/components/scorecard/ScorecardView'
import Link from 'next/link'

export default function DashboardScorecard() {
  const [scorecard, setScorecard] = useState<PrimeScorecard | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadScorecard()
  }, [])

  async function loadScorecard() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/prime-scorecard/latest')
      
      if (res.ok) {
        const data = await res.json()
        setScorecard(data.scorecard)
      } else if (res.status === 404) {
        // No scorecard exists yet
        setScorecard(null)
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

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/prime-scorecard/generate', {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setScorecard(data.scorecard)
      } else {
        setError('Failed to generate scorecard')
      }
    } catch (err) {
      console.error('Scorecard generate error:', err)
      setError('Network error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-black">Prime Scorecard</h2>
            <p className="text-[13px] text-[#8E8E93]">Loading...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[#F2F2F7] rounded-xl" />
          <div className="h-16 bg-[#F2F2F7] rounded-xl" />
          <div className="h-16 bg-[#F2F2F7] rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#FF3B30] flex items-center justify-center">
            <span className="text-white">!</span>
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-black">Prime Scorecard</h2>
            <p className="text-[13px] text-[#FF3B30]">{error}</p>
          </div>
        </div>
        <button
          onClick={loadScorecard}
          className="text-[#007AFF] font-semibold text-[15px]"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!scorecard) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-black">Prime Scorecard</h2>
            <p className="text-[13px] text-[#8E8E93]">Your health across 5 dimensions</p>
          </div>
        </div>

        <div className="bg-[#F2F2F7] rounded-xl p-6 text-center">
          <p className="text-[15px] text-[#8E8E93] mb-4">
            No scorecard generated yet. Generate your first Prime Scorecard to see your health overview.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#007AFF] text-white py-2 px-6 rounded-lg text-[15px] font-semibold hover:bg-[#0066DD] transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Scorecard'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link href="/data" className="text-[14px] text-[#007AFF]">
            Import health data for better insights →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-black">Prime Scorecard</h2>
            <p className="text-[13px] text-[#8E8E93]">Your health across 5 dimensions</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-[13px] text-[#007AFF] font-medium hover:opacity-70 disabled:opacity-50"
        >
          {generating ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      <ScorecardView scorecard={scorecard} showHowCalculated={true} compact={false} />
    </div>
  )
}

