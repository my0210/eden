'use client'

import { useState, useTransition } from 'react'

interface Habit {
  id: string
  title: string
  description: string | null
  frequency: string
  current_streak: number
  best_streak: number
}

interface HabitTrackerProps {
  habits: Habit[]
}

export default function HabitTracker({ habits: initialHabits }: HabitTrackerProps) {
  const [habits, setHabits] = useState(initialHabits)
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const [loggingId, setLoggingId] = useState<string | null>(null)

  const handleLog = async (habitId: string, isLogged: boolean) => {
    setLoggingId(habitId)
    
    startTransition(async () => {
      try {
        const res = await fetch(`/api/coaching/habits/${habitId}/log`, {
          method: isLogged ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            date: new Date().toISOString().slice(0, 10),
            completed: true 
          }),
        })
        
        if (res.ok) {
          const data = await res.json()
          
          // Update local state
          setTodayLogs(prev => ({ ...prev, [habitId]: !isLogged }))
          
          // Update streak if returned
          if (data.current_streak !== undefined) {
            setHabits(prev => prev.map(h => 
              h.id === habitId 
                ? { 
                    ...h, 
                    current_streak: data.current_streak,
                    best_streak: Math.max(h.best_streak, data.current_streak)
                  }
                : h
            ))
          }
        }
      } catch (error) {
        console.error('Failed to log habit:', error)
      } finally {
        setLoggingId(null)
      }
    })
  }

  if (habits.length === 0) {
    return null
  }

  const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekdays: 'Weekdays',
    '3x_week': '3x/week',
    '5x_week': '5x/week',
    custom: 'Custom',
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-[17px] font-semibold text-black mb-4">Daily Habits</h2>
      
      <div className="space-y-4">
        {habits.map((habit) => {
          const isLogged = todayLogs[habit.id] ?? false
          const isLoading = loggingId === habit.id
          
          return (
            <div 
              key={habit.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#F2F2F7]"
            >
              {/* Log button */}
              <button
                onClick={() => handleLog(habit.id, isLogged)}
                disabled={isPending}
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isLogged 
                    ? 'bg-[#FF9500] text-white' 
                    : 'bg-white border-2 border-[#C7C7CC] text-[#8E8E93]'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isLogged ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
              </button>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-black">{habit.title}</p>
                
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-[#8E8E93] bg-white px-2 py-0.5 rounded-full">
                    {frequencyLabels[habit.frequency] || habit.frequency}
                  </span>
                  
                  {habit.current_streak > 0 && (
                    <span className="text-[11px] text-[#FF9500] font-medium">
                      🔥 {habit.current_streak} day streak
                    </span>
                  )}
                </div>
                
                {habit.description && (
                  <p className="text-[13px] text-[#8E8E93] mt-1 line-clamp-1">
                    {habit.description}
                  </p>
                )}
              </div>
              
              {/* Streak display */}
              {habit.best_streak > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] text-[#8E8E93]">Best</p>
                  <p className="text-[15px] font-semibold text-[#FF9500]">{habit.best_streak}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Today indicator */}
      <div className="mt-4 pt-4 border-t border-[#E5E5EA] text-center">
        <p className="text-[13px] text-[#8E8E93]">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>
    </div>
  )
}

