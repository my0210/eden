'use client'

interface Milestone {
  id: string
  phase_number: number
  title: string
  description: string | null
  success_criteria: string | null
  target_date: string | null
  status: string
}

interface MilestoneTimelineProps {
  milestones: Milestone[]
}

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (milestones.length === 0) {
    return null
  }

  const currentPhase = milestones.find(m => m.status === 'current')?.phase_number || 1

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-[17px] font-semibold text-black mb-4">Journey</h2>
      
      <div className="relative">
        {/* Progress line */}
        <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-[#E5E5EA]" />
        
        {/* Completed progress overlay */}
        <div 
          className="absolute left-4 top-8 w-0.5 bg-[#34C759] transition-all duration-500"
          style={{ 
            height: `${Math.max(0, ((currentPhase - 1) / Math.max(1, milestones.length - 1)) * 100)}%` 
          }}
        />
        
        <div className="space-y-6">
          {milestones.map((milestone) => {
            const isCompleted = milestone.status === 'completed'
            const isCurrent = milestone.status === 'current'
            const isPending = milestone.status === 'pending'
            
            return (
              <div key={milestone.id} className="flex gap-4">
                {/* Status indicator */}
                <div className="relative z-10 flex-shrink-0">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? 'bg-[#34C759]' 
                        : isCurrent 
                          ? 'bg-[#007AFF]' 
                          : 'bg-[#E5E5EA]'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className={`text-[13px] font-medium ${
                        isCurrent ? 'text-white' : 'text-[#8E8E93]'
                      }`}>
                        {milestone.phase_number}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-[15px] font-medium ${
                      isPending ? 'text-[#8E8E93]' : 'text-black'
                    }`}>
                      {milestone.title}
                    </h3>
                    {isCurrent && (
                      <span className="text-[11px] font-medium text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  
                  {milestone.description && (
                    <p className={`text-[13px] mt-1 ${
                      isPending ? 'text-[#C7C7CC]' : 'text-[#8E8E93]'
                    }`}>
                      {milestone.description}
                    </p>
                  )}
                  
                  {milestone.target_date && (
                    <p className={`text-[11px] mt-1 ${
                      isPending ? 'text-[#C7C7CC]' : 'text-[#8E8E93]'
                    }`}>
                      Target: {new Date(milestone.target_date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  )}
                  
                  {isCurrent && milestone.success_criteria && (
                    <div className="mt-2 p-3 bg-[#F2F2F7] rounded-lg">
                      <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">Success criteria</p>
                      <p className="text-[13px] text-black">{milestone.success_criteria}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

