'use client'

/**
 * About You Section - Memory Display
 * 
 * Shows what Eden knows about the user with clear sourcing.
 * Users can remove items and add new facts.
 */

import { useState, useEffect } from 'react'

interface StatedFact {
  fact: string
  date: string
  source: string
}

interface InferredPattern {
  pattern: string
  confidence?: string
}

interface NotableEvent {
  date: string
  description: string
  source: string
}

interface ConfirmedData {
  prime_check?: {
    name?: string
    age?: number
    sex?: string
    height?: number
    weight?: number
    location?: string
  }
  apple_health?: {
    current?: {
      rhr?: number
      sleep_avg?: number
      steps_avg?: number
    }
    baseline?: {
      rhr?: number
      sleep_avg?: number
    }
  }
  labs?: {
    current?: Record<string, { value: number; unit: string; status: string }>
  }
  body_photos?: {
    current?: {
      body_fat_estimate?: number
      date?: string
    }
    baseline?: {
      body_fat_estimate?: number
    }
  }
  protocol?: {
    goal_title?: string
    current_week?: number
    duration_weeks?: number
  }
}

interface MemoryData {
  confirmed: ConfirmedData
  stated: StatedFact[]
  inferred: InferredPattern[]
  notable_events: NotableEvent[]
  updated_at?: string
}

export default function AboutYouSection() {
  const [memory, setMemory] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newFact, setNewFact] = useState('')
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetchMemory()
  }, [])

  async function fetchMemory() {
    try {
      const res = await fetch('/api/user/memory')
      if (res.ok) {
        const data = await res.json()
        setMemory(data)
      }
    } catch (err) {
      console.error('Failed to fetch memory:', err)
    } finally {
      setLoading(false)
    }
  }

  async function removeItem(type: 'stated' | 'inferred', text: string) {
    try {
      const res = await fetch(`/api/user/memory?type=${type}&text=${encodeURIComponent(text)}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchMemory()
      }
    } catch (err) {
      console.error('Failed to remove item:', err)
    }
  }

  async function addFact() {
    if (!newFact.trim()) return
    
    setAdding(true)
    try {
      const res = await fetch('/api/user/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact: newFact.trim() })
      })
      if (res.ok) {
        setNewFact('')
        fetchMemory()
      }
    } catch (err) {
      console.error('Failed to add fact:', err)
    } finally {
      setAdding(false)
    }
  }

  async function clearAll() {
    if (!confirm('Clear all of Eden\'s memory about you? This cannot be undone.')) return
    
    try {
      const res = await fetch('/api/user/memory?type=all', { method: 'DELETE' })
      if (res.ok) {
        fetchMemory()
      }
    } catch (err) {
      console.error('Failed to clear memory:', err)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-800 rounded w-full"></div>
            <div className="h-4 bg-gray-800 rounded w-5/6"></div>
            <div className="h-4 bg-gray-800 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  const confirmed = memory?.confirmed || {}
  const stated = memory?.stated || []
  const inferred = memory?.inferred || []
  const events = memory?.notable_events || []

  // Format trend indicator
  const formatTrend = (current?: number, baseline?: number) => {
    if (current === undefined || baseline === undefined) return ''
    const diff = current - baseline
    if (diff === 0) return ''
    return diff > 0 ? ` (↑${Math.abs(diff).toFixed(1)})` : ` (↓${Math.abs(diff).toFixed(1)})`
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">What Eden Knows About You</h2>
            <p className="text-sm text-gray-400 mt-1">
              Built from your data and conversations. Eden uses this to personalize your coaching.
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* From Your Data */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            From Your Data
          </h3>
          <div className="space-y-2 text-sm">
            {confirmed.prime_check && (
              <div className="text-gray-300">
                <span className="text-gray-500">Prime Check:</span>{' '}
                {[
                  confirmed.prime_check.age && `${confirmed.prime_check.age}yo`,
                  confirmed.prime_check.sex,
                  confirmed.prime_check.location && `in ${confirmed.prime_check.location}`,
                  confirmed.prime_check.height && `${confirmed.prime_check.height}cm`,
                  confirmed.prime_check.weight && `${confirmed.prime_check.weight}kg`,
                ].filter(Boolean).join(', ') || 'No data yet'}
              </div>
            )}
            
            {confirmed.apple_health?.current && (
              <div className="text-gray-300">
                <span className="text-gray-500">Apple Health:</span>{' '}
                {[
                  confirmed.apple_health.current.rhr && 
                    `RHR ${confirmed.apple_health.current.rhr}bpm${formatTrend(confirmed.apple_health.current.rhr, confirmed.apple_health.baseline?.rhr)}`,
                  confirmed.apple_health.current.sleep_avg && 
                    `Sleep ${confirmed.apple_health.current.sleep_avg}h${formatTrend(confirmed.apple_health.current.sleep_avg, confirmed.apple_health.baseline?.sleep_avg)}`,
                  confirmed.apple_health.current.steps_avg && 
                    `${Math.round(confirmed.apple_health.current.steps_avg).toLocaleString()} steps`,
                ].filter(Boolean).join(', ') || 'No data'}
              </div>
            )}

            {confirmed.labs?.current && Object.keys(confirmed.labs.current).length > 0 && (
              <div className="text-gray-300">
                <span className="text-gray-500">Labs:</span>{' '}
                {Object.entries(confirmed.labs.current)
                  .filter(([key]) => key !== 'date')
                  .map(([key, val]) => {
                    if (typeof val === 'object' && val.status && val.status !== 'normal') {
                      return `${key.replace(/_/g, ' ')} ${val.status}`
                    }
                    return null
                  })
                  .filter(Boolean)
                  .join(', ') || 'All normal'}
              </div>
            )}

            {confirmed.body_photos?.current && (
              <div className="text-gray-300">
                <span className="text-gray-500">Photos:</span>{' '}
                {confirmed.body_photos.current.body_fat_estimate 
                  ? `~${confirmed.body_photos.current.body_fat_estimate}% body fat${
                      confirmed.body_photos.baseline?.body_fat_estimate
                        ? formatTrend(confirmed.body_photos.current.body_fat_estimate, confirmed.body_photos.baseline.body_fat_estimate)
                        : ''
                    }`
                  : 'Analyzed'}
              </div>
            )}

            {confirmed.protocol?.goal_title && (
              <div className="text-gray-300">
                <span className="text-gray-500">Goal:</span>{' '}
                {confirmed.protocol.goal_title}
                {confirmed.protocol.current_week && confirmed.protocol.duration_weeks && 
                  ` (Week ${confirmed.protocol.current_week}/${confirmed.protocol.duration_weeks})`}
              </div>
            )}
          </div>
        </div>

        {/* From Conversations */}
        {stated.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              From Our Conversations
            </h3>
            <div className="space-y-2">
              {stated.slice(0, expanded ? undefined : 5).map((item, idx) => (
                <div key={idx} className="flex items-start justify-between group">
                  <span className="text-sm text-gray-300">• {item.fact}</span>
                  <button
                    onClick={() => removeItem('stated', item.fact)}
                    className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  >
                    remove
                  </button>
                </div>
              ))}
              {!expanded && stated.length > 5 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-sm text-gray-500 hover:text-gray-400"
                >
                  +{stated.length - 5} more...
                </button>
              )}
            </div>
          </div>
        )}

        {/* Patterns Eden Noticed */}
        {inferred.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Patterns Eden Noticed
              <span className="text-xs text-gray-600 font-normal ml-2">(may be wrong)</span>
            </h3>
            <div className="space-y-2">
              {inferred.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between group">
                  <span className="text-sm text-gray-300">• {item.pattern}</span>
                  <button
                    onClick={() => removeItem('inferred', item.pattern)}
                    className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Events */}
        {events.length > 0 && expanded && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Recent Events
            </h3>
            <div className="space-y-2">
              {events.slice(0, 10).map((event, idx) => {
                const date = new Date(event.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })
                return (
                  <div key={idx} className="text-sm text-gray-400">
                    <span className="text-gray-500">{date}:</span> {event.description}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add Fact */}
        <div className="pt-4 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
              placeholder="Add something Eden should know..."
              className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addFact()}
            />
            <button
              onClick={addFact}
              disabled={adding || !newFact.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? '...' : 'Add'}
            </button>
          </div>
        </div>

        {/* Clear All */}
        {(stated.length > 0 || inferred.length > 0) && (
          <div className="pt-2">
            <button
              onClick={clearAll}
              className="text-xs text-gray-600 hover:text-red-400"
            >
              Clear all memory
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

