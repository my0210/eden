import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { 
  EdenMetricCategory, 
  EdenMetricDefinition, 
  CategoryWithMetrics,
  MetricWithValue 
} from '@/lib/types/eden'
import AppleHealthUpload from './AppleHealthUpload'
import EdenCoachChat from './EdenCoachChat'

// Category icons and colors
const categoryConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
  heart: { 
    icon: '❤️', 
    color: 'text-red-600', 
    bgColor: 'bg-red-50 border-red-200' 
  },
  frame: { 
    icon: '🦴', 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-50 border-amber-200' 
  },
  metabolism: { 
    icon: '🔥', 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-50 border-orange-200' 
  },
  recovery: { 
    icon: '😴', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50 border-blue-200' 
  },
  mind: { 
    icon: '🧠', 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-50 border-purple-200' 
  },
}

async function getEdenMetrics(userId: string): Promise<{ categories: CategoryWithMetrics[], error: string | null }> {
  const supabase = await createClient()
  
  // Fetch all categories ordered by sort_order
  const { data: categories, error: categoriesError } = await supabase
    .from('eden_metric_categories')
    .select('*')
    .order('sort_order', { ascending: true })
  
  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError)
    return { 
      categories: [], 
      error: `Categories error: ${categoriesError.message}. This might be an RLS policy issue.` 
    }
  }
  
  if (!categories || categories.length === 0) {
    return { 
      categories: [], 
      error: 'No categories found. Check if eden_metric_categories table has data and RLS policies allow reading.' 
    }
  }
  
  // Fetch all metric definitions
  const { data: definitions, error: definitionsError } = await supabase
    .from('eden_metric_definitions')
    .select('*')
    .order('display_order', { ascending: true })
  
  if (definitionsError) {
    console.error('Error fetching definitions:', definitionsError)
    return { 
      categories: [], 
      error: `Definitions error: ${definitionsError.message}` 
    }
  }
  
  // Fetch latest values for this user
  // We need to get the most recent value for each metric
  const { data: values, error: valuesError } = await supabase
    .from('eden_metric_values')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
  
  if (valuesError) {
    console.error('Error fetching values:', valuesError)
    // Continue without values - we'll show "No data yet"
  }
  
  // Create a map of metric_id to latest value
  const latestValues = new Map<string, { value: number; measuredAt: string }>()
  if (values) {
    for (const v of values) {
      // Only keep the first (most recent) value for each metric
      if (!latestValues.has(v.metric_id)) {
        latestValues.set(v.metric_id, {
          value: v.value,
          measuredAt: v.measured_at,
        })
      }
    }
  }
  
  // Build the result structure
  const result: CategoryWithMetrics[] = (categories as EdenMetricCategory[]).map(category => {
    const categoryMetrics = (definitions as EdenMetricDefinition[])
      .filter(def => def.category_code === category.category_code)
      .map(def => {
        const latest = latestValues.get(def.id)
        return {
          ...def,
          latestValue: latest?.value ?? null,
          measuredAt: latest?.measuredAt ?? null,
        } as MetricWithValue
      })
    
    return {
      ...category,
      metrics: categoryMetrics,
    }
  })
  
  return { categories: result, error: null }
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return 'No data yet'
  
  // Format the number based on the unit
  if (unit === '%') {
    return `${value.toFixed(1)}%`
  } else if (unit === 'bpm' || unit === 'mmHg' || unit === 'mg/dL') {
    return `${Math.round(value)} ${unit}`
  } else if (unit === 'hours' || unit === 'hrs') {
    return `${value.toFixed(1)} hrs`
  } else if (unit === 'kg') {
    return `${value.toFixed(1)} kg`
  } else if (unit === 'lbs') {
    return `${value.toFixed(1)} lbs`
  } else if (unit === 'score' || unit === 'points') {
    return `${Math.round(value)}`
  } else if (unit) {
    return `${value} ${unit}`
  }
  return `${value}`
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const { categories: categoriesWithMetrics, error } = await getEdenMetrics(user.id)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user.email?.split('@')[0]}
        </h1>
        <p className="text-gray-600 mt-1">
          Your Eden metrics at a glance
        </p>
      </div>

      {/* Apple Health Upload Section */}
      <div className="mb-8">
        <AppleHealthUpload userId={user.id} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm font-medium">Error loading metrics:</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <p className="text-red-500 text-xs mt-2">
            Make sure RLS policies are configured in Supabase to allow authenticated users to read the tables.
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      {categoriesWithMetrics.length === 0 && !error ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No metrics configured yet.</p>
        </div>
      ) : categoriesWithMetrics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoriesWithMetrics.map((category) => {
            const config = categoryConfig[category.category_code] || {
              icon: '📊',
              color: 'text-gray-600',
              bgColor: 'bg-gray-50 border-gray-200',
            }
            
            return (
              <div
                key={category.category_code}
                className={`rounded-xl border-2 ${config.bgColor} overflow-hidden`}
              >
                {/* Category Header */}
                <div className="px-5 py-4 border-b border-inherit">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <h2 className={`text-lg font-semibold ${config.color}`}>
                      {category.name}
                    </h2>
                  </div>
                </div>
                
                {/* Metrics List */}
                <div className="divide-y divide-inherit">
                  {category.metrics.length === 0 ? (
                    <div className="px-5 py-4 text-gray-500 text-sm">
                      No metrics in this category
                    </div>
                  ) : (
                    category.metrics.map((metric) => (
                      <div
                        key={metric.id}
                        className="px-5 py-3 hover:bg-white/50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {metric.name}
                            </p>
                            {metric.measuredAt && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {formatDate(metric.measuredAt)}
                              </p>
                            )}
                          </div>
                          <div className="ml-4 flex-shrink-0 text-right">
                            <p className={`text-sm font-semibold ${
                              metric.latestValue !== null 
                                ? config.color 
                                : 'text-gray-400'
                            }`}>
                              {formatValue(metric.latestValue, metric.unit)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Eden Coach Chat Section */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Chat with Eden</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ask Eden about your current status or what to focus on this week.
        </p>
        <EdenCoachChat />
      </section>
    </div>
  )
}

