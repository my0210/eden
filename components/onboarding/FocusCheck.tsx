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
  // Conservative thresholds - tune based on data later
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (state === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (state === 'countdown' && countdown === 0) {
      startTest()
    }
  }, [state, countdown])

  // Main test timer
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

  // Intro screen
  if (state === 'intro') {
    return (
      <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h4 className="text-[15px] font-semibold text-black">Focus Check (60s)</h4>
            <p className="text-[12px] text-[#8E8E93]">Quick attention test</p>
          </div>
        </div>
        
        <p className="text-[14px] text-[#3C3C43]">
          Tap as soon as the dot appears. Stay relaxed.
        </p>
        
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleStartTest}
            className="flex-1 py-3 px-4 bg-[#007AFF] text-white text-[15px] font-semibold rounded-xl"
          >
            Start Test
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="py-3 px-4 text-[#8E8E93] text-[14px] font-medium"
            >
              Skip
            </button>
          )}
        </div>
        
        <p className="text-[11px] text-[#8E8E93]">
          This objective test measures sustained attention and is more accurate than self-report.
        </p>
      </div>
    )
  }

  // Countdown screen
  if (state === 'countdown') {
    return (
      <div className="p-8 bg-black rounded-xl flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-white/60 text-[14px] mb-4">Get ready...</p>
        <div className="text-[64px] font-bold text-white">{countdown}</div>
      </div>
    )
  }

  // Test running (waiting or stimulus)
  if (state === 'waiting' || state === 'stimulus') {
    return (
      <div 
        className="relative bg-black rounded-xl min-h-[280px] flex flex-col items-center justify-center cursor-pointer select-none touch-none"
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault()
          handleTap()
        }}
      >
        {/* Timer */}
        <div className="absolute top-4 right-4 text-white/40 text-[14px] font-mono">
          {timeLeft}s
        </div>
        
        {/* Progress */}
        <div className="absolute top-4 left-4 text-white/40 text-[12px]">
          {reactionTimes.length} taps
        </div>
        
        {/* Stimulus dot */}
        {state === 'stimulus' && (
          <div className="w-16 h-16 rounded-full bg-[#007AFF] animate-pulse" />
        )}
        
        {/* Waiting state */}
        {state === 'waiting' && (
          <p className="text-white/30 text-[14px]">Wait for the dot...</p>
        )}
        
        {/* Tap hint */}
        <p className="absolute bottom-4 text-white/20 text-[12px]">
          Tap anywhere when you see the dot
        </p>
      </div>
    )
  }

  // Complete screen
  if (state === 'complete' && result) {
    return (
      <div className="p-4 bg-[#F2F2F7] rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            focusLevel === 'strong' ? 'bg-[#34C759]' : 
            focusLevel === 'ok' ? 'bg-[#FF9500]' : 'bg-[#FF3B30]'
          }`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="text-[15px] font-semibold text-black">Focus Check Complete</h4>
            <p className="text-[12px] text-[#8E8E93]">
              Baseline focus: <span className={`font-medium ${
                focusLevel === 'strong' ? 'text-[#34C759]' : 
                focusLevel === 'ok' ? 'text-[#FF9500]' : 'text-[#FF3B30]'
              }`}>
                {focusLevel === 'strong' ? 'Strong' : focusLevel === 'ok' ? 'OK' : 'Low'}
              </span>
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white rounded-lg">
            <div className="text-[18px] font-semibold text-black">{result.median_rt_ms}</div>
            <div className="text-[11px] text-[#8E8E93]">Median RT (ms)</div>
          </div>
          <div className="p-3 bg-white rounded-lg">
            <div className="text-[18px] font-semibold text-black">{result.lapses}</div>
            <div className="text-[11px] text-[#8E8E93]">Lapses</div>
          </div>
          <div className="p-3 bg-white rounded-lg">
            <div className="text-[18px] font-semibold text-black">{result.variability_ms}</div>
            <div className="text-[11px] text-[#8E8E93]">Variability</div>
          </div>
        </div>
        
        <p className="text-[12px] text-[#8E8E93]">
          Confidence: Medium (single session). Repeat over 7-14 days for higher accuracy.
        </p>
        
        <button
          type="button"
          onClick={handleConfirmResult}
          className="w-full py-3 px-4 bg-[#007AFF] text-white text-[15px] font-semibold rounded-xl"
        >
          Save Result
        </button>
      </div>
    )
  }

  return null
}

