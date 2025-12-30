'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FocusCheckResult, FocusLevel } from '@/lib/onboarding/types'

interface FocusCheckProps {
  onComplete: (result: FocusCheckResult) => void
  onSkip?: () => void
}

type TestState = 'intro' | 'countdown' | 'waiting' | 'stimulus' | 'complete'

const TEST_DURATION_SECONDS = 60
const LAPSE_THRESHOLD_MS = 500
const MIN_INTERVAL_MS = 2000
const MAX_INTERVAL_MS = 5000

/**
 * Calculate median of an array of numbers
 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Calculate IQR (interquartile range) for variability
 */
function calculateIQR(arr: number[]): number {
  if (arr.length < 4) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const q1 = median(sorted.slice(0, Math.floor(sorted.length / 2)))
  const q3 = median(sorted.slice(Math.ceil(sorted.length / 2)))
  return q3 - q1
}

/**
 * Derive focus level from metrics
 */
function deriveFocusLevel(medianRt: number, lapses: number, variability: number): FocusLevel {
  if (medianRt < 300 && lapses <= 2 && variability < 80) return 'strong'
  if (medianRt < 400 && lapses <= 5 && variability < 120) return 'ok'
  return 'low'
}

export default function FocusCheck({ onComplete, onSkip }: FocusCheckProps) {
  const [state, setState] = useState<TestState>('intro')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [stimulusCount, setStimulusCount] = useState(0)
  const [result, setResult] = useState<FocusCheckResult | null>(null)
  
  const stimulusTimeRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (state === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (state === 'countdown' && countdown === 0) {
      startTest()
    }
  }, [state, countdown])

  useEffect(() => {
    if (state === 'waiting' || state === 'stimulus') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            finishTest()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [state])

  const startTest = useCallback(() => {
    setReactionTimes([])
    setStimulusCount(0)
    setTimeLeft(TEST_DURATION_SECONDS)
    scheduleNextStimulus()
  }, [])

  const scheduleNextStimulus = useCallback(() => {
    setState('waiting')
    const delay = Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS) + MIN_INTERVAL_MS
    
    intervalRef.current = setTimeout(() => {
      stimulusTimeRef.current = performance.now()
      setStimulusCount(prev => prev + 1)
      setState('stimulus')
    }, delay)
  }, [])

  const handleTap = useCallback(() => {
    if (state !== 'stimulus') return
    
    const rt = performance.now() - stimulusTimeRef.current
    setReactionTimes(prev => [...prev, rt])
    
    if (timeLeft > 0) {
      scheduleNextStimulus()
    }
  }, [state, timeLeft, scheduleNextStimulus])

  const finishTest = useCallback(() => {
    if (intervalRef.current) clearTimeout(intervalRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    
    const medianRt = median(reactionTimes)
    const lapses = reactionTimes.filter(rt => rt > LAPSE_THRESHOLD_MS).length
    const variability = calculateIQR(reactionTimes)
    
    const focusResult: FocusCheckResult = {
      median_rt_ms: Math.round(medianRt),
      lapses,
      variability_ms: Math.round(variability),
      total_stimuli: stimulusCount,
      reaction_times_ms: reactionTimes.map(rt => Math.round(rt)),
      completed_at: new Date().toISOString(),
      duration_seconds: TEST_DURATION_SECONDS,
    }
    
    setResult(focusResult)
    setState('complete')
  }, [reactionTimes, stimulusCount])

  const handleStartTest = () => {
    setCountdown(3)
    setState('countdown')
  }

  const handleConfirmResult = () => {
    if (result) {
      onComplete(result)
    }
  }

  const focusLevel = result ? deriveFocusLevel(result.median_rt_ms, result.lapses, result.variability_ms) : null

  // ========== INTRO SCREEN ==========
  if (state === 'intro') {
    return (
      <div className="rounded-xl overflow-hidden border border-[#007AFF]/20">
        {/* Header */}
        <div className="bg-[#007AFF] p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="text-[18px] font-bold">Focus Check</h4>
              <p className="text-[14px] text-white/80">60-second attention test</p>
            </div>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="p-5 bg-white space-y-5">
          {/* Main instruction */}
          <div className="text-center py-4">
            <p className="text-[20px] font-semibold text-black mb-2">
              Tap when you see the dot
            </p>
            <p className="text-[15px] text-[#8E8E93]">
              React as fast as you can. Stay relaxed.
            </p>
          </div>
          
          {/* Visual example */}
          <div className="flex items-center justify-center gap-4 py-4 bg-[#F2F2F7] rounded-xl">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#1C1C1E] flex items-center justify-center mb-2 mx-auto">
                <span className="text-white/40 text-[11px]">wait</span>
              </div>
              <p className="text-[12px] text-[#8E8E93]">Screen is dark</p>
            </div>
            <svg className="w-6 h-6 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#1C1C1E] flex items-center justify-center mb-2 mx-auto">
                <div className="w-8 h-8 rounded-full bg-[#007AFF]" />
              </div>
              <p className="text-[12px] text-[#8E8E93]">Dot appears</p>
            </div>
            <svg className="w-6 h-6 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#34C759] flex items-center justify-center mb-2 mx-auto">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[12px] text-[#8E8E93]">TAP!</p>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleStartTest}
              className="w-full py-4 px-4 bg-[#007AFF] text-white text-[17px] font-semibold rounded-xl active:bg-[#0056b3]"
            >
              Start Test
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="w-full py-3 text-[#8E8E93] text-[15px] font-medium"
              >
                Skip for now
              </button>
            )}
          </div>
          
          {/* Note */}
          <p className="text-[12px] text-[#8E8E93] text-center">
            This objective test is more accurate than self-assessment
          </p>
        </div>
      </div>
    )
  }

  // ========== COUNTDOWN SCREEN ==========
  if (state === 'countdown') {
    return (
      <div className="bg-[#1C1C1E] rounded-xl flex flex-col items-center justify-center min-h-[320px]">
        <p className="text-white/60 text-[18px] mb-6">Get ready...</p>
        <div className="text-[96px] font-bold text-white leading-none">{countdown}</div>
        <p className="text-white/40 text-[14px] mt-6">
          Tap the screen when the blue dot appears
        </p>
      </div>
    )
  }

  // ========== TEST RUNNING ==========
  if (state === 'waiting' || state === 'stimulus') {
    return (
      <div 
        className="relative bg-[#1C1C1E] rounded-xl min-h-[320px] flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault()
          handleTap()
        }}
      >
        {/* Timer - more prominent */}
        <div className="absolute top-5 right-5">
          <div className="bg-white/10 px-3 py-1.5 rounded-full">
            <span className="text-white text-[16px] font-mono font-medium">{timeLeft}s</span>
          </div>
        </div>
        
        {/* Progress - more prominent */}
        <div className="absolute top-5 left-5">
          <div className="bg-white/10 px-3 py-1.5 rounded-full">
            <span className="text-white/80 text-[14px]">{reactionTimes.length} taps</span>
          </div>
        </div>
        
        {/* Stimulus dot - BIGGER */}
        {state === 'stimulus' && (
          <div className="w-24 h-24 rounded-full bg-[#007AFF] shadow-[0_0_40px_rgba(0,122,255,0.6)]" />
        )}
        
        {/* Waiting state - MUCH clearer */}
        {state === 'waiting' && (
          <div className="text-center">
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-4">
              <span className="text-white/30 text-[14px]">...</span>
            </div>
            <p className="text-white/50 text-[18px] font-medium">Wait for the dot</p>
          </div>
        )}
        
        {/* Bottom instruction - clearer */}
        <div className="absolute bottom-5 left-0 right-0 text-center">
          <p className="text-white/40 text-[14px]">
            {state === 'stimulus' ? '👆 TAP NOW!' : 'Tap anywhere when the blue dot appears'}
          </p>
        </div>
      </div>
    )
  }

  // ========== COMPLETE SCREEN ==========
  if (state === 'complete' && result) {
    return (
      <div className="rounded-xl overflow-hidden border border-[#34C759]/20">
        {/* Header */}
        <div className={`p-4 text-white ${
          focusLevel === 'strong' ? 'bg-[#34C759]' : 
          focusLevel === 'ok' ? 'bg-[#FF9500]' : 'bg-[#FF3B30]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-[18px] font-bold">Test Complete</h4>
              <p className="text-[15px] text-white/90">
                Baseline focus: {focusLevel === 'strong' ? 'Strong' : focusLevel === 'ok' ? 'OK' : 'Low'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Results */}
        <div className="p-5 bg-white space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-[#F2F2F7] rounded-xl text-center">
              <div className="text-[24px] font-bold text-black">{result.median_rt_ms}</div>
              <div className="text-[12px] text-[#8E8E93] mt-1">Reaction (ms)</div>
            </div>
            <div className="p-4 bg-[#F2F2F7] rounded-xl text-center">
              <div className="text-[24px] font-bold text-black">{result.lapses}</div>
              <div className="text-[12px] text-[#8E8E93] mt-1">Lapses</div>
            </div>
            <div className="p-4 bg-[#F2F2F7] rounded-xl text-center">
              <div className="text-[24px] font-bold text-black">{result.variability_ms}</div>
              <div className="text-[12px] text-[#8E8E93] mt-1">Variability</div>
            </div>
          </div>
          
          <p className="text-[13px] text-[#8E8E93] text-center">
            Confidence: Medium • Repeat over 7-14 days for higher accuracy
          </p>
          
          <button
            type="button"
            onClick={handleConfirmResult}
            className="w-full py-4 px-4 bg-[#007AFF] text-white text-[17px] font-semibold rounded-xl active:bg-[#0056b3]"
          >
            Save Result
          </button>
        </div>
      </div>
    )
  }

  return null
}
