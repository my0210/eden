'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Action {
  id: string
  title: string
  description: string | null
  cadence: string | null
  completed_at: string | null
  priority: number
}

interface ActionListProps {
  actions: Action[]
}

export default function ActionList({ actions: initialActions }: ActionListProps) {
  const [actions, setActions] = useState(initialActions)
  const [isPending, startTransition] = useTransition()
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  const handleToggle = async (actionId: string, currentlyCompleted: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompletingId(actionId)
    
    startTransition(async () => {
      try {
        const res = await fetch(`/api/coaching/actions/${actionId}/complete`, {
          method: currentlyCompleted ? 'DELETE' : 'POST',
        })
        
        if (res.ok) {
          setActions(prev => prev.map(a => 
            a.id === actionId 
              ? { ...a, completed_at: currentlyCompleted ? null : new Date().toISOString() }
              : a
          ))
        }
      } catch (error) {
        console.error('Failed to toggle action:', error)
      } finally {
        setCompletingId(null)
      }
    })
  }

  const handleAskEden = (action: Action, e: React.MouseEvent) => {
    e.stopPropagation()
    // Navigate to chat with pre-filled message about this action
    const message = encodeURIComponent(`Tell me more about "${action.title}"`)
    router.push(`/chat?message=${message}`)
  }

  const toggleExpand = (actionId: string) => {
    setExpandedId(expandedId === actionId ? null : actionId)
  }

  if (actions.length === 0) {
    return null
  }

  const completedCount = actions.filter(a => a.completed_at).length

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-semibold text-black">This Week&apos;s Actions</h2>
        <span className="text-[13px] text-[#8E8E93]">
          {completedCount}/{actions.length} done
        </span>
      </div>
      
      <div className="space-y-3">
        {actions.map((action) => {
          const isCompleted = !!action.completed_at
          const isLoading = completingId === action.id
          const isExpanded = expandedId === action.id
          
          return (
            <div
              key={action.id}
              className={`rounded-xl border transition-all ${
                isCompleted 
                  ? 'bg-[#F2F2F7] border-[#E5E5EA]' 
                  : 'bg-white border-[#E5E5EA] hover:border-[#007AFF]/30'
              }`}
            >
              {/* Main action row */}
              <div 
                className="flex items-start gap-3 p-4 cursor-pointer"
                onClick={() => toggleExpand(action.id)}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => handleToggle(action.id, isCompleted, e)}
                  disabled={isPending}
                  className="flex-shrink-0 mt-0.5 disabled:opacity-50"
                >
                  <div 
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isCompleted 
                        ? 'bg-[#34C759] border-[#34C759]' 
                        : 'border-[#C7C7CC] hover:border-[#34C759]'
                    }`}
                  >
                    {isLoading ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isCompleted ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                </button>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[15px] font-medium ${
                    isCompleted ? 'text-[#8E8E93] line-through' : 'text-black'
                  }`}>
                    {action.title}
                  </p>
                  
                  {action.cadence && (
                    <span className={`inline-block text-[11px] mt-1 px-2 py-0.5 rounded-full ${
                      isCompleted 
                        ? 'bg-[#E5E5EA] text-[#8E8E93]' 
                        : 'bg-[#007AFF]/10 text-[#007AFF]'
                    }`}>
                      {action.cadence}
                    </span>
                  )}

                  {/* Completed timestamp */}
                  {isCompleted && action.completed_at && (
                    <p className="text-[11px] text-[#8E8E93] mt-1">
                      Completed {new Date(action.completed_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  )}
                </div>

                {/* Expand indicator */}
                {!isCompleted && (
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

              {/* Expanded content */}
              {isExpanded && !isCompleted && (
                <div className="px-4 pb-4 pt-0 border-t border-[#E5E5EA]">
                  {/* Description */}
                  {action.description && (
                    <p className="text-[14px] text-[#3C3C43] mt-3 leading-relaxed">
                      {action.description}
                    </p>
                  )}

                  {/* Ask Eden button */}
                  <button
                    onClick={(e) => handleAskEden(action, e)}
                    className="mt-4 flex items-center gap-2 text-[14px] text-[#007AFF] hover:text-[#0051D4] transition-colors"
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
}
