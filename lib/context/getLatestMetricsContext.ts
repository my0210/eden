import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Read-only context for AI coach and dashboard.
 * Does NOT write to the database.
 */
export type MetricsContext = {
  userId: string
  profile: {
    firstName: string | null
    age: number | null
    sexAtBirth: string | null
    heightCm: number | null
    weightKg: number | null
    primaryGoal: string | null
  }
  metrics: Array<{
    metricId: string
    metricCode: string
    metricName: string
    unit: string | null
    categoryCode: string | null
    categoryName: string | null
    latestValue: number | null
    latestMeasuredAt: string | null
  }>
  retrievedAt: string
}

/**
 * Retrieves the latest metrics context for a user.
 * This is READ-ONLY - no database writes occur.
 * 
 * Used by:
 * - buildEdenContext() for AI coach
 * - Debug endpoints
 * 
 * NOT used for Prime Scorecard generation (that's a separate process).
 */
export async function getLatestMetricsContext(
  supabase: SupabaseClient,
  userId: string
): Promise<MetricsContext> {
  // 1. Load Eden user profile
  const { data: profileData } = await supabase
    .from('eden_user_profile')
    .select('first_name, age, sex_at_birth, height_cm, weight_kg, primary_goal')
    .eq('user_id', userId)
    .maybeSingle()

  // 2. Load all metric values for this user with definitions and categories
  const { data: metricValues } = await supabase
    .from('eden_metric_values')
    .select(`
      id,
      metric_id,
      value,
      measured_at,
      eden_metric_definitions (
        id,
        metric_code,
        name,
        unit,
        category_code,
        eden_metric_categories (
          category_code,
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })

  // 3. Deduplicate to get only the latest value per metric
  const latestByMetric = new Map<string, {
    metricId: string
    metricCode: string
    metricName: string
    unit: string | null
    categoryCode: string | null
    categoryName: string | null
    latestValue: number | null
    latestMeasuredAt: string | null
  }>()

  if (metricValues) {
    for (const mv of metricValues) {
      const metricId = mv.metric_id
      // Skip if we already have this metric (first one is most recent due to order)
      if (latestByMetric.has(metricId)) continue

      // Extract definition and category info (cast through unknown for type safety)
      const def = mv.eden_metric_definitions as unknown as {
        id: string
        metric_code: string
        name: string
        unit: string | null
        category_code: string | null
        eden_metric_categories: {
          category_code: string
          name: string
        } | null
      } | null

      latestByMetric.set(metricId, {
        metricId: metricId,
        metricCode: def?.metric_code || '',
        metricName: def?.name || '',
        unit: def?.unit || null,
        categoryCode: def?.category_code || null,
        categoryName: def?.eden_metric_categories?.name || null,
        latestValue: mv.value,
        latestMeasuredAt: mv.measured_at,
      })
    }
  }

  // 4. Build and return the context (NO DATABASE WRITES)
  return {
    userId,
    profile: {
      firstName: profileData?.first_name || null,
      age: profileData?.age || null,
      sexAtBirth: profileData?.sex_at_birth || null,
      heightCm: profileData?.height_cm || null,
      weightKg: profileData?.weight_kg || null,
      primaryGoal: profileData?.primary_goal || null,
    },
    metrics: Array.from(latestByMetric.values()),
    retrievedAt: new Date().toISOString(),
  }
}

