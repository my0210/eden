'use client'

import { useState } from 'react'

interface Decision {
  id: string
  protocol_id: string
  trigger_type: string
  trigger_context: Record<string, unknown> | null
  reason: string
  changes_made: Record<string, unknown> | null
  expected_outcome: string | null
  reevaluate_at: string | null
  outcome_notes: string | null
  outcome_status: string | null
  created_at: string
  protocol_version: number
}

interface ChangeHistoryProps {
  decisions: Decision[]
}

const triggerLabels: Record<string, string> = {
  weekly_review: 'Weekly Review',
  milestone_review: 'Milestone Review',
  user_request: 'Your Request',
  metric_change: 'Scorecard Update',
  coach_recommendation: 'Coach Recommendation',
  initial_generation: 'Initial Plan',
}

const outcomeLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending review', color: 'text-[#8E8E93]' },
  successful: { label: 'Worked well', color: 'text-[#34C759]' },
  unsuccessful: { label: 'Didn\'t help', color: 'text-[#FF3B30]' },
  mixed: { label: 'Mixed results', color: 'text-[#FF9500]' },
}

export default function ChangeHistory({ decisions }: ChangeHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (decisions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-[#F2F2F7] rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-[15px] text-[#8E8E93]">No changes yet</p>
        <p className="text-[13px] text-[#C7C7CC] mt-1">
          Your plan history will appear here as Eden adapts your protocol.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {decisions.map((decision) => {
        const isExpanded = expandedId === decision.id
        const trigger = triggerLabels[decision.trigger_type] || decision.trigger_type
        const outcome = decision.outcome_status ? outcomeLabels[decision.outcome_status] : null
        const changes = decision.changes_made as {
          actions?: { added?: string[]; removed?: string[] }
          habits?: { added?: string[]; removed?: string[] }
          summary?: string
        } | null

        return (
          <div key={decision.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header - always visible */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : decision.id)}
              className="w-full p-4 text-left flex items-start gap-4 hover:bg-[#F2F2F7]/50 transition-colors"
            >
              {/* Version badge */}
              <div className="flex-shrink-0 w-10 h-10 bg-[#007AFF]/10 rounded-full flex items-center justify-center">
                <span className="text-[13px] font-semibold text-[#007AFF]">
                  v{decision.protocol_version}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide">
                    {trigger}
                  </span>
                  <span className="text-[11px] text-[#C7C7CC]">•</span>
                  <span className="text-[11px] text-[#8E8E93]">
                    {new Date(decision.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <p className="text-[15px] text-black line-clamp-2">{decision.reason}</p>

                {outcome && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[13px] font-medium ${outcome.color}`}>
                      {outcome.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Expand indicator */}
              <svg 
                className={`w-5 h-5 text-[#C7C7CC] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-0 border-t border-[#E5E5EA] ml-14">
                {/* Changes made */}
                {changes && (changes.actions || changes.habits || changes.summary) && (
                  <div className="mt-4">
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-2">What changed</p>
                    
                    {changes.summary && (
                      <p className="text-[13px] text-black mb-2">{changes.summary}</p>
                    )}

                    <div className="space-y-2">
                      {changes.actions?.added?.map((action, i) => (
                        <div key={`add-action-${i}`} className="flex items-center gap-2 text-[13px]">
                          <span className="text-[#34C759]">+</span>
                          <span className="text-black">{action}</span>
                          <span className="text-[#8E8E93]">(action)</span>
                        </div>
                      ))}
                      {changes.actions?.removed?.map((action, i) => (
                        <div key={`rm-action-${i}`} className="flex items-center gap-2 text-[13px]">
                          <span className="text-[#FF3B30]">−</span>
                          <span className="text-[#8E8E93] line-through">{action}</span>
                          <span className="text-[#8E8E93]">(action)</span>
                        </div>
                      ))}
                      {changes.habits?.added?.map((habit, i) => (
                        <div key={`add-habit-${i}`} className="flex items-center gap-2 text-[13px]">
                          <span className="text-[#34C759]">+</span>
                          <span className="text-black">{habit}</span>
                          <span className="text-[#8E8E93]">(habit)</span>
                        </div>
                      ))}
                      {changes.habits?.removed?.map((habit, i) => (
                        <div key={`rm-habit-${i}`} className="flex items-center gap-2 text-[13px]">
                          <span className="text-[#FF3B30]">−</span>
                          <span className="text-[#8E8E93] line-through">{habit}</span>
                          <span className="text-[#8E8E93]">(habit)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected outcome */}
                {decision.expected_outcome && (
                  <div className="mt-4">
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">Expected outcome</p>
                    <p className="text-[13px] text-black">{decision.expected_outcome}</p>
                  </div>
                )}

                {/* Re-evaluation date */}
                {decision.reevaluate_at && (
                  <div className="mt-4">
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">Re-evaluate by</p>
                    <p className="text-[13px] text-black">
                      {new Date(decision.reevaluate_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                {/* Outcome notes */}
                {decision.outcome_notes && (
                  <div className="mt-4 p-3 bg-[#F2F2F7] rounded-lg">
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">Outcome notes</p>
                    <p className="text-[13px] text-black">{decision.outcome_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

