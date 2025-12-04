// Eden database types

export interface EdenMetricCategory {
  category_code: string
  name: string
  sort_order: number
}

export interface EdenMetricDefinition {
  id: string
  metric_code: string
  name: string
  category_code: string
  unit: string
  display_order: number
}

export interface EdenMetricValue {
  user_id: string
  metric_id: string
  value: number
  measured_at: string
}

// Combined type for dashboard display
export interface MetricWithValue extends EdenMetricDefinition {
  latestValue: number | null
  measuredAt: string | null
}

export interface CategoryWithMetrics extends EdenMetricCategory {
  metrics: MetricWithValue[]
}

