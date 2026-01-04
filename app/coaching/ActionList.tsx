'use client'

import { useState, useTransition } from 'react'

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

  const handleToggle = async (actionId: string, currentlyCompleted: boolean) => {
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

  if (actions.length === 0) {
    return null
  }

  const completedCount = actions.filter(a => a.completed_at).length

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-semibold text-black">Actions</h2>
        <span className="text-[13px] text-[#8E8E93]">
          {completedCount}/{actions.length} done
        </span>
      </div>
      
      <div className="space-y-3">
        {actions.map((action) => {
          const isCompleted = !!action.completed_at
          const isLoading = completingId === action.id
          
          return (
            <button
              key={action.id}
              onClick={() => handleToggle(action.id, isCompleted)}
              disabled={isPending}
              className="w-full flex items-start gap-3 p-3 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors text-left disabled:opacity-50"
            >
              {/* Checkbox */}
              <div className="flex-shrink-0 mt-0.5">
                <div 
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'bg-[#34C759] border-[#34C759]' 
                      : 'border-[#C7C7CC]'
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
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-medium ${
                  isCompleted ? 'text-[#8E8E93] line-through' : 'text-black'
                }`}>
                  {action.title}
                </p>
                
                {action.description && !isCompleted && (
                  <p className="text-[13px] text-[#8E8E93] mt-0.5 line-clamp-2">
                    {action.description}
                  </p>
                )}
                
                {action.cadence && (
                  <span className={`inline-block text-[11px] mt-1 px-2 py-0.5 rounded-full ${
                    isCompleted 
                      ? 'bg-[#E5E5EA] text-[#8E8E93]' 
                      : 'bg-[#007AFF]/10 text-[#007AFF]'
                  }`}>
                    {action.cadence}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

