/**
 * Trend Digest - Compute trends from Apple Health and other data sources
 * 
 * Instead of storing raw data, we compute:
 * - Current snapshot
 * - Direction of change (improving/declining/stable)
 * - Magnitude of change
 * - Notable anomalies
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateMemory, applyMemoryPatches, NotableEvent } from './memory'

// ============================================================================
// Types
// ============================================================================

interface TrendResult {
  current: number
  baseline: number
  direction: 'improving' | 'declining' | 'stable'
  magnitude: number  // absolute change
  percentChange: number
}

interface AppleHealthTrends {
  rhr?: TrendResult
  sleep?: TrendResult
  steps?: TrendResult
  hrv?: TrendResult
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Compute trends from Apple Health data and update memory
 * Should be run periodically (e.g., weekly) or on-demand
 */
export async function computeAppleHealthTrends(
  supabase: SupabaseClient,
  userId: string
): Promise<AppleHealthTrends | null> {
  const memory = await getOrCreateMemory(supabase, userId)
  const baseline = memory.confirmed.apple_health?.baseline

  if (!baseline) {
    console.log('No baseline set, skipping trend computation')
    return null
  }

  // Get recent metrics (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data: recentMetrics } = await supabase
    .from('eden_health_metrics')
    .select('metric_key, value_raw, measured_at')
    .eq('user_id', userId)
    .gte('measured_at', sevenDaysAgo)
    .in('metric_key', [
      'apple_health_resting_heart_rate',
      'apple_health_sleep_duration',
      'apple_health_step_count',
      'apple_health_hrv'
    ])
    .order('measured_at', { ascending: false })

  if (!recentMetrics?.length) {
    return null
  }

  // Compute averages for recent period
  const rhrValues = recentMetrics
    .filter(m => m.metric_key === 'apple_health_resting_heart_rate' && m.value_raw)
    .map(m => m.value_raw)
  
  const sleepValues = recentMetrics
    .filter(m => m.metric_key === 'apple_health_sleep_duration' && m.value_raw)
    .map(m => m.value_raw)
  
  const stepsValues = recentMetrics
    .filter(m => m.metric_key === 'apple_health_step_count' && m.value_raw)
    .map(m => m.value_raw)

  const hrvValues = recentMetrics
    .filter(m => m.metric_key === 'apple_health_hrv' && m.value_raw)
    .map(m => m.value_raw)

  const trends: AppleHealthTrends = {}
  const notableEvents: NotableEvent[] = []

  // Calculate RHR trend (lower is better)
  if (rhrValues.length > 0 && baseline.rhr) {
    const currentRhr = average(rhrValues)
    trends.rhr = computeTrend(currentRhr, baseline.rhr, 'lower_better')
    
    if (trends.rhr.direction === 'improving' && Math.abs(trends.rhr.magnitude) >= 3) {
      notableEvents.push({
        date: new Date().toISOString(),
        description: `RHR improved by ${Math.abs(trends.rhr.magnitude).toFixed(0)}bpm`,
        source: 'apple_health'
      })
    }
  }

  // Calculate sleep trend (higher is better, up to a point)
  if (sleepValues.length > 0 && baseline.sleep_avg) {
    const currentSleep = average(sleepValues)
    trends.sleep = computeTrend(currentSleep, baseline.sleep_avg, 'higher_better')
    
    if (trends.sleep.direction === 'improving' && Math.abs(trends.sleep.magnitude) >= 0.5) {
      notableEvents.push({
        date: new Date().toISOString(),
        description: `Sleep improved by ${Math.abs(trends.sleep.magnitude).toFixed(1)}h avg`,
        source: 'apple_health'
      })
    }
  }

  // Calculate steps trend (higher is better)
  if (stepsValues.length > 0 && baseline.steps_avg) {
    const currentSteps = average(stepsValues)
    trends.steps = computeTrend(currentSteps, baseline.steps_avg, 'higher_better')
    
    if (trends.steps.direction === 'improving' && trends.steps.percentChange >= 20) {
      notableEvents.push({
        date: new Date().toISOString(),
        description: `Steps up ${trends.steps.percentChange.toFixed(0)}% from baseline`,
        source: 'apple_health'
      })
    }
  }

  // Calculate HRV trend (higher is better)
  if (hrvValues.length > 0 && baseline.hrv_avg) {
    const currentHrv = average(hrvValues)
    trends.hrv = computeTrend(currentHrv, baseline.hrv_avg, 'higher_better')
  }

  // Update memory with current values and trends
  const currentData = {
    rhr: rhrValues.length > 0 ? average(rhrValues) : baseline.rhr,
    sleep_avg: sleepValues.length > 0 ? average(sleepValues) : baseline.sleep_avg,
    steps_avg: stepsValues.length > 0 ? average(stepsValues) : baseline.steps_avg,
    hrv_avg: hrvValues.length > 0 ? average(hrvValues) : baseline.hrv_avg
  }

  const trendSummary = {
    rhr: trends.rhr?.direction,
    sleep: trends.sleep?.direction,
    steps: trends.steps?.direction,
    hrv: trends.hrv?.direction
  }

  await applyMemoryPatches(supabase, userId, {
    update_confirmed: {
      'apple_health.current': currentData,
      'apple_health.trend': trendSummary
    },
    add_events: notableEvents
  })

  return trends
}

/**
 * Detect anomalies in recent data
 * Returns events for significant deviations from baseline
 */
export async function detectAnomalies(
  supabase: SupabaseClient,
  userId: string
): Promise<NotableEvent[]> {
  const memory = await getOrCreateMemory(supabase, userId)
  const baseline = memory.confirmed.apple_health?.baseline

  if (!baseline) return []

  // Get yesterday's data
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const dayBefore = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const { data: yesterdayMetrics } = await supabase
    .from('eden_health_metrics')
    .select('metric_key, value_raw')
    .eq('user_id', userId)
    .gte('measured_at', dayBefore.toISOString())
    .lte('measured_at', yesterday.toISOString())
    .in('metric_key', ['apple_health_sleep_duration', 'apple_health_resting_heart_rate'])

  const anomalies: NotableEvent[] = []

  if (yesterdayMetrics) {
    // Check for unusually low sleep
    const sleepMetric = yesterdayMetrics.find(m => m.metric_key === 'apple_health_sleep_duration')
    if (sleepMetric?.value_raw && baseline.sleep_avg) {
      const deviation = (baseline.sleep_avg - sleepMetric.value_raw) / baseline.sleep_avg
      if (deviation > 0.3) { // 30% below baseline
        anomalies.push({
          date: yesterday.toISOString(),
          description: `Sleep was ${sleepMetric.value_raw.toFixed(1)}h (${(deviation * 100).toFixed(0)}% below normal)`,
          source: 'apple_health'
        })
      }
    }

    // Check for unusually high RHR
    const rhrMetric = yesterdayMetrics.find(m => m.metric_key === 'apple_health_resting_heart_rate')
    if (rhrMetric?.value_raw && baseline.rhr) {
      const deviation = (rhrMetric.value_raw - baseline.rhr) / baseline.rhr
      if (deviation > 0.15) { // 15% above baseline
        anomalies.push({
          date: yesterday.toISOString(),
          description: `RHR elevated to ${rhrMetric.value_raw}bpm (${(deviation * 100).toFixed(0)}% above normal)`,
          source: 'apple_health'
        })
      }
    }
  }

  // Add anomalies to memory
  if (anomalies.length > 0) {
    await applyMemoryPatches(supabase, userId, {
      add_events: anomalies
    })
  }

  return anomalies
}

// ============================================================================
// Helpers
// ============================================================================

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function computeTrend(
  current: number,
  baseline: number,
  direction: 'higher_better' | 'lower_better'
): TrendResult {
  const magnitude = current - baseline
  const percentChange = baseline !== 0 ? ((current - baseline) / baseline) * 100 : 0

  let trendDirection: 'improving' | 'declining' | 'stable'
  
  // Consider stable if change is less than 5%
  if (Math.abs(percentChange) < 5) {
    trendDirection = 'stable'
  } else if (direction === 'higher_better') {
    trendDirection = current > baseline ? 'improving' : 'declining'
  } else {
    trendDirection = current < baseline ? 'improving' : 'declining'
  }

  return {
    current,
    baseline,
    direction: trendDirection,
    magnitude,
    percentChange
  }
}

