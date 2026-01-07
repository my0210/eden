'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export interface WeekItem {
  id: string
  week_id: string
  title: string
  description: string | null
  target_value: string | null
  target_count: number
  completed_count: number
  completion_events: Array<{ at: string; notes?: string }>
  skipped_at: string | null
  skip_reason: string | null
  domain?: string
}

interface WeekItemListProps {
  items: WeekItem[]
  groupByDomain?: boolean
}

const DOMAIN_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  heart: { name: 'Heart', color: '#FF2D55', bgColor: 'bg-[#FF2D55]' },
  frame: { name: 'Frame', color: '#5856D6', bgColor: 'bg-[#5856D6]' },
  metabolism: { name: 'Metabolism', color: '#FF9500', bgColor: 'bg-[#FF9500]' },
  recovery: { name: 'Recovery', color: '#34C759', bgColor: 'bg-[#34C759]' },
  mind: { name: 'Mind', color: '#007AFF', bgColor: 'bg-[#007AFF]' },
}

export default function WeekItemList({ items: initialItems, groupByDomain = true }: WeekItemListProps) {
  const [items, setItems] = useState(initialItems)
  const [isPending, startTransition] = useTransition()
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  const handleComplete = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setLoadingItemId(itemId)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/coaching/week-items/${itemId}/complete`, {
          method: 'POST',
        })

        if (res.ok) {
          const data = await res.json()
          setItems(prev => prev.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  completed_count: data.completed_count,
                  completion_events: data.completion_events,
                }
              : item
          ))
        }
      } catch (error) {
        console.error('Failed to complete item:', error)
      } finally {
        setLoadingItemId(null)
      }
    })
  }

  const handleUndo = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setLoadingItemId(itemId)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/coaching/week-items/${itemId}/complete`, {
          method: 'DELETE',
        })

        if (res.ok) {
          const data = await res.json()
          setItems(prev => prev.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  completed_count: data.completed_count,
                  completion_events: data.completion_events,
                }
              : item
          ))
        }
      } catch (error) {
        console.error('Failed to undo completion:', error)
      } finally {
        setLoadingItemId(null)
      }
    })
  }

  const handleAskEden = (item: WeekItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const message = encodeURIComponent(`Tell me more about "${item.title}"`)
    router.push(`/chat?message=${message}`)
  }

  if (items.length === 0) {
    return null
  }

  // Group items by domain if requested
  const groupedItems = groupByDomain
    ? items.reduce((acc, item) => {
        const domain = item.domain || 'other'
        if (!acc[domain]) acc[domain] = []
        acc[domain].push(item)
        return acc
      }, {} as Record<string, WeekItem[]>)
    : { all: items }

  // Calculate totals
  const totalTarget = items.reduce((sum, item) => sum + item.target_count, 0)
  const totalCompleted = items.reduce((sum, item) => sum + item.completed_count, 0)
  const overallPercent = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-semibold text-black">This Week</h2>
          <span className="text-[15px] font-medium text-[#007AFF]">
            {overallPercent}%
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-3 bg-[#F2F2F7] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#34C759] to-[#30D158] rounded-full transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        
        <p className="text-[13px] text-[#8E8E93] mt-2">
          {totalCompleted} of {totalTarget} completions
        </p>
      </div>

      {/* Items by Domain */}
      {Object.entries(groupedItems).map(([domain, domainItems]) => {
        const config = DOMAIN_CONFIG[domain] || { name: domain, color: '#8E8E93', bgColor: 'bg-[#8E8E93]' }
        const domainTarget = domainItems.reduce((sum, item) => sum + item.target_count, 0)
        const domainCompleted = domainItems.reduce((sum, item) => sum + item.completed_count, 0)
        
        return (
          <div key={domain} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Domain Header */}
            {groupByDomain && domain !== 'all' && (
              <div className="px-6 py-4 border-b border-[#E5E5EA] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}
                  >
                    <DomainIcon domain={domain} />
                  </div>
                  <span className="text-[15px] font-semibold text-black">{config.name}</span>
                </div>
                <span className="text-[13px] text-[#8E8E93]">
                  {domainCompleted}/{domainTarget}
                </span>
              </div>
            )}
            
            {/* Items */}
            <div className="divide-y divide-[#E5E5EA]">
              {domainItems.map((item) => {
                const isComplete = item.completed_count >= item.target_count
                const isLoading = loadingItemId === item.id
                const isExpanded = expandedId === item.id
                const progress = item.target_count > 0 
                  ? Math.min((item.completed_count / item.target_count) * 100, 100)
                  : 0

                return (
                  <div key={item.id}>
                    <div
                      className={`p-4 cursor-pointer transition-colors ${
                        isComplete ? 'bg-[#F2F2F7]/50' : 'hover:bg-[#F2F2F7]/30'
                      }`}
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Completion Button */}
                        <button
                          onClick={(e) => isComplete ? handleUndo(item.id, e) : handleComplete(item.id, e)}
                          disabled={isPending}
                          className="flex-shrink-0 mt-0.5 disabled:opacity-50"
                        >
                          <CompletionIndicator
                            completed={item.completed_count}
                            target={item.target_count}
                            isLoading={isLoading}
                          />
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[15px] font-medium ${
                            isComplete ? 'text-[#8E8E93] line-through' : 'text-black'
                          }`}>
                            {item.title}
                          </p>

                          {/* Target Value Badge */}
                          {item.target_value && (
                            <span className={`inline-block text-[11px] mt-1 px-2 py-0.5 rounded-full ${
                              isComplete
                                ? 'bg-[#E5E5EA] text-[#8E8E93]'
                                : 'bg-[#007AFF]/10 text-[#007AFF]'
                            }`}>
                              {item.target_value}
                            </span>
                          )}

                          {/* Progress Text */}
                          {item.target_count > 1 && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex-1 h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#34C759] rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-[#8E8E93]">
                                {item.completed_count}/{item.target_count}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expand Indicator */}
                        {!isComplete && (
                          <svg
                            className={`w-5 h-5 text-[#C7C7CC] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && !isComplete && (
                      <div className="px-4 pb-4 bg-[#F2F2F7]/30">
                        {item.description && (
                          <p className="text-[14px] text-[#3C3C43] mb-3 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {/* Completion History */}
                        {item.completion_events.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[11px] text-[#8E8E93] mb-1">Completed:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.completion_events.map((event, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] bg-[#34C759]/10 text-[#34C759] px-2 py-0.5 rounded"
                                >
                                  {new Date(event.at).toLocaleDateString('en-US', { weekday: 'short' })}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={(e) => handleAskEden(item, e)}
                          className="flex items-center gap-2 text-[14px] text-[#007AFF] hover:text-[#0051D4] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Ask Eden about this
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Completion indicator component
function CompletionIndicator({ completed, target, isLoading }: { completed: number; target: number; isLoading: boolean }) {
  const isComplete = completed >= target

  if (isLoading) {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-[#34C759] flex items-center justify-center">
        <div className="w-3 h-3 border-2 border-[#34C759] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="w-6 h-6 rounded-full bg-[#34C759] flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }

  if (target === 1) {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-[#C7C7CC] hover:border-[#34C759] transition-colors" />
    )
  }

  // Multi-completion: show progress ring
  const progress = (completed / target) * 100
  const circumference = 2 * Math.PI * 10
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="#E5E5EA"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="#34C759"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-300"
      />
    </svg>
  )
}

// Domain icon component
function DomainIcon({ domain }: { domain: string }) {
  const iconPaths: Record<string, React.ReactNode> = {
    heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
    frame: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    metabolism: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
    recovery: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
    mind: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
  }

  return (
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {iconPaths[domain] || iconPaths.mind}
    </svg>
  )
}

