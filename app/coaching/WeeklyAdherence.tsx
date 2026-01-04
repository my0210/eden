'use client'

import { useEffect, useState } from 'react'

interface Action {
  id: string
  title: string
  completed_at: string | null
}

interface WeeklyAdherenceProps {
  protocolId: string
  actions: Action[]
}

interface WeeklyStats {
  actionsCompleted: number
  actionsTotal: number
}

export default function WeeklyAdherence({ protocolId, actions }: WeeklyAdherenceProps) {
  const [stats, setStats] = useState<WeeklyStats>({
    actionsCompleted: 0,
    actionsTotal: actions.length,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      if (!protocolId) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/coaching/adherence?protocolId=${protocolId}`)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch adherence stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [protocolId])

  // Calculate percentage
  const actionPercent = stats.actionsTotal > 0 
    ? Math.round((stats.actionsCompleted / stats.actionsTotal) * 100) 
    : 0

  // Get day of week (0 = Sunday)
  const today = new Date().getDay()
  const daysIntoWeek = today === 0 ? 7 : today // Monday = 1, Sunday = 7

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-[17px] font-semibold text-black mb-4">This Week</h2>
      
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Actions Progress */}
          <div className="bg-[#F2F2F7] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-[#8E8E93]">Actions Completed</span>
              <span className="text-[15px] font-semibold text-black">
                {stats.actionsCompleted}/{stats.actionsTotal}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-white rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#34C759] rounded-full transition-all duration-500"
                style={{ width: `${actionPercent}%` }}
              />
            </div>
            
            <p className="text-[11px] text-[#8E8E93] mt-2">
              {actionPercent >= 80 ? '🎉 Great progress!' : 
               actionPercent >= 50 ? '💪 Keep going!' : 
               actionPercent > 0 ? '🌱 Just starting' : 'Start checking off actions'}
            </p>
          </div>
        </div>
      )}

      {/* Day indicator */}
      <div className="mt-4 pt-4 border-t border-[#E5E5EA]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#8E8E93]">Week progress</span>
          <span className="text-[11px] text-[#8E8E93]">Day {daysIntoWeek} of 7</span>
        </div>
        <div className="flex gap-1 mt-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
            const dayNum = i + 1
            const isPast = dayNum < daysIntoWeek
            const isToday = dayNum === daysIntoWeek
            
            return (
              <div 
                key={i}
                className={`flex-1 h-8 rounded flex items-center justify-center text-[11px] font-medium ${
                  isToday 
                    ? 'bg-[#007AFF] text-white' 
                    : isPast 
                      ? 'bg-[#34C759]/20 text-[#34C759]' 
                      : 'bg-[#F2F2F7] text-[#8E8E93]'
                }`}
              >
                {day}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
